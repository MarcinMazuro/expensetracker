import "server-only";
import { classifyItems } from "./ai/gemini";
import { normalizeProductName } from "./ai/receipt-schema";
import { listCategories } from "./categories";
import { rememberMerchant, rememberProducts } from "./expenses";
import { userCollection } from "./firestore";
import { rateToPln } from "./fx";
import { convert } from "./money";
import { isProductGroup } from "./product-groups";
import { splitAmount, splitItems } from "./split";
import { merchantKey } from "./text";
import type { Expense, ExpenseSource, ReceiptItem, SharedInfo, User } from "./types";
import { activeUsers } from "./users";
import type { ExpenseInput } from "./validation";

/**
 * Product name and group for every line: kept if present, else from the
 * user's product memory, else classified by Gemini in one batch. If the
 * model is unavailable the line still saves, as "other".
 */
export async function completeItems(uid: string, items: ReceiptItem[]): Promise<ReceiptItem[]> {
  const missing = items.filter((i) => !i.product || !i.group);
  if (missing.length === 0) return items;

  const catalog = await userCollection(uid, "products").get();
  const groups = new Map(catalog.docs.map((d) => [d.id, d.data().group as string]));
  const names = catalog.docs.map((d) => d.data().name as string);

  const unknown = missing.filter((i) => !groups.has(merchantKey(normalizeProductName(i.product, i.name))));
  let classified = new Map<string, { product: string; group: string }>();
  if (unknown.length > 0) {
    try {
      const result = await classifyItems(unknown.map((i) => i.name), names);
      classified = new Map(unknown.map((i, n) => [i.name, result[n]]).filter(([, r]) => r) as [string, { product: string; group: string }][]);
    } catch (error) {
      console.error("Classifying items failed:", error);
    }
  }

  return items.map((item) => {
    if (item.product && item.group) return item;
    const fromModel = classified.get(item.name);
    const product = normalizeProductName(item.product ?? fromModel?.product, item.name);
    const known = groups.get(merchantKey(product));
    const group = item.group ?? (isProductGroup(known) ? known : isProductGroup(fromModel?.group) ? fromModel.group : "other");
    return { ...item, product, group, quantity: item.quantity ?? 1, unit: item.unit ?? "szt" };
  });
}

/** The people an expense is shared with: every active account, in sign-up order. */
async function householdIds(): Promise<string[]> {
  return (await activeUsers()).map((u) => u.id);
}

export interface WriteOptions {
  /** Existing expense id when editing; new expenses get a fresh id. */
  id?: string;
  shared: boolean;
  source: ExpenseSource;
  items?: ReceiptItem[];
  receiptPath?: string;
  /** Who made the change, when it is not the owner (the other person edited it). */
  editedBy?: string;
}

/**
 * Creates or updates an expense. A shared expense is written to every
 * participant under the SAME document id, each with their share of the
 * amount and of every line, in their own category of the same name. So
 * editing or deleting it from either account reaches both copies, and the
 * shared view sums the copies back to the whole without double counting.
 */
export async function writeExpense(editor: User, input: ExpenseInput, options: WriteOptions): Promise<{ id: string; participants: string[] }> {
  const ref = options.id ? userCollection(editor.id, "expenses").doc(options.id) : userCollection(editor.id, "expenses").doc();
  const id = ref.id;
  const previous = options.id ? ((await ref.get()).data() as Omit<Expense, "id"> | undefined) : undefined;
  const now = new Date().toISOString();
  const fxRate = await rateToPln(input.currency, input.date);
  const items = options.items ?? previous?.shared?.items ?? previous?.items;

  const participants = options.shared ? (previous?.shared?.participants ?? (await householdIds())) : [editor.id];
  if (options.shared && !participants.includes(editor.id)) participants.push(editor.id);
  const paidBy = previous?.shared?.paidBy ?? editor.id;
  const payerIndex = Math.max(0, participants.indexOf(paidBy));
  const shares = splitAmount(input.amount, participants.length, payerIndex);
  const editorCategory = (await listCategories(editor.id)).find((c) => c.id === input.categoryId);

  await Promise.all(
    participants.map(async (uid, index) => {
      const target = userCollection(uid, "expenses").doc(id);
      const existing = uid === editor.id ? previous : ((await target.get()).data() as Omit<Expense, "id"> | undefined);
      // The same category by name in the other person's list; else what they had; else "Inne"
      let categoryId = input.categoryId;
      if (uid !== editor.id) {
        const theirs = await listCategories(uid);
        categoryId =
          theirs.find((c) => c.name.toLowerCase() === editorCategory?.name.toLowerCase())?.id ??
          existing?.categoryId ??
          theirs.find((c) => c.name === "Inne")?.id ??
          theirs[0]?.id ??
          input.categoryId;
      }
      const amount = shares[index];
      const shared: SharedInfo | undefined = options.shared
        ? { total: input.amount, participants, paidBy, ...(items?.length && { items }) }
        : undefined;
      const lineItems = items?.length
        ? options.shared ? splitItems(items, participants.length, index, payerIndex) : items
        : undefined;

      await target.set({
        ...input,
        categoryId,
        amount,
        fxRate,
        amountPln: convert(amount, fxRate),
        source: existing?.source ?? options.source,
        ...((options.receiptPath ?? existing?.receiptPath) && { receiptPath: options.receiptPath ?? existing?.receiptPath }),
        ...(existing?.recurringId && { recurringId: existing.recurringId }),
        ...(lineItems && { items: lineItems }),
        ...(shared && { shared }),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        updatedBy: options.editedBy ?? editor.id,
      });
      await rememberMerchant(uid, input.merchant, categoryId);
      if (lineItems) await rememberProducts(uid, lineItems);
    }),
  );

  // Un-sharing: the other people's copies go away, the editor keeps the whole amount
  for (const uid of previous?.shared?.participants ?? []) {
    if (!participants.includes(uid)) await userCollection(uid, "expenses").doc(id).delete();
  }
  return { id, participants };
}

/** Deletes an expense and, if it was shared, every copy of it. Returns the receipt photo it used, if any. */
export async function removeExpenseEverywhere(editor: User, id: string): Promise<Expense | null> {
  const doc = await userCollection(editor.id, "expenses").doc(id).get();
  if (!doc.exists) return null;
  const expense = { id, ...doc.data() } as Expense;
  const owners = expense.shared?.participants ?? [editor.id];
  await Promise.all([...new Set([...owners, editor.id])].map((uid) => userCollection(uid, "expenses").doc(id).delete()));
  return expense;
}
