import "server-only";
import { db, userCollection } from "./firestore";
import { rateToPln } from "./fx";
import { convert } from "./money";
import { merchantKey } from "./text";
import { hiddenLines, isHiddenNow, isVisibleTo, projectFor } from "./visibility";
import type { Expense, ExpenseSource, ReceiptItem } from "./types";
import type { ExpenseInput } from "./validation";

function toExpense(id: string, data: FirebaseFirestore.DocumentData): Expense {
  return { id, ...(data as Omit<Expense, "id">) };
}

/** Expenses with from <= date <= to, newest first. */
export async function listExpenses(uid: string, from: string, to: string): Promise<Expense[]> {
  const snapshot = await userCollection(uid, "expenses")
    .where("date", ">=", from)
    .where("date", "<=", to)
    .orderBy("date", "desc")
    .get();
  // Same day: the most recently added first
  return snapshot.docs
    .map((doc) => toExpense(doc.id, doc.data()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export async function getExpense(uid: string, id: string): Promise<Expense | null> {
  const doc = await userCollection(uid, "expenses").doc(id).get();
  return doc.exists ? toExpense(doc.id, doc.data()!) : null;
}

/** Someone's expenses as the viewer may see them: without what is hidden from them, amounts corrected. */
export async function listVisibleExpenses(viewerId: string, ownerId: string, from: string, to: string): Promise<Expense[]> {
  return (await listExpenses(ownerId, from, to)).flatMap((e) => projectFor(e, ownerId, viewerId) ?? []);
}

/** One expense as the viewer may see it, or null when it does not exist or is hidden from them. */
export async function getVisibleExpense(viewerId: string, ownerId: string, id: string): Promise<Expense | null> {
  const expense = await getExpense(ownerId, id);
  return expense ? projectFor(expense, ownerId, viewerId) : null;
}

export interface WholeView {
  /** The whole amount before dividing, as far as the viewer may see it. */
  total: number;
  /** Every line before dividing, without the ones hidden from the viewer. */
  items: ReceiptItem[];
  /** The account that keeps the full version; only its owner can hide things. */
  home: string;
  hidden: boolean;
  hiddenUntil?: string;
}

/**
 * An expense from `accountId` for the edit page: the account's copy, plus
 * the whole expense it is a part of. For a shared expense the whole comes
 * from the home account's copy.
 */
export async function loadWhole(viewerId: string, accountId: string, id: string): Promise<{ expense: Expense; whole: WholeView } | null> {
  const raw = await getExpense(accountId, id);
  const expense = raw && projectFor(raw, accountId, viewerId);
  if (!raw || !expense) return null;

  const home = raw.shared ? (raw.shared.home ?? raw.shared.paidBy) : accountId;
  let source = expense;
  if (raw.shared && home !== accountId) {
    const homeCopy = await getExpense(home, id);
    source = (homeCopy && projectFor(homeCopy, home, viewerId)) ?? expense;
  }
  return {
    expense,
    whole: {
      total: source.shared?.total ?? source.amount,
      items: source.shared ? (source.shared.items ?? []) : (source.items ?? []),
      home,
      hidden: source.hidden === true,
      ...(source.hiddenUntil && { hiddenUntil: source.hiddenUntil }),
    },
  };
}

/** Copies in someone's account whose owner still owes the payer their part, newest first. */
export async function listUnsettled(uid: string): Promise<Expense[]> {
  const snapshot = await userCollection(uid, "expenses").where("unsettled", "==", true).get();
  return snapshot.docs.map((doc) => toExpense(doc.id, doc.data())).sort((a, b) => b.date.localeCompare(a.date));
}

/** The owner's expenses with something hidden right now - the whole expense or single lines - newest first. */
export async function listHiddenExpenses(uid: string): Promise<Expense[]> {
  const [whole, timed] = await Promise.all([
    userCollection(uid, "expenses").where("hidden", "==", true).get(),
    userCollection(uid, "expenses").orderBy("date", "desc").limit(300).get(),
  ]);
  const byId = new Map([...whole.docs, ...timed.docs].map((doc) => [doc.id, toExpense(doc.id, doc.data())]));
  return [...byId.values()]
    .filter((e) => isHiddenNow(e) || hiddenLines(e).length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** A receipt photo may be opened if it belongs to the viewer or to an expense visible to them. */
export async function receiptVisibleTo(viewerId: string, ownerId: string, receiptPath: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const snapshot = await userCollection(ownerId, "expenses").where("receiptPath", "==", receiptPath).get();
  return snapshot.docs.some((doc) => isVisibleTo(doc.data(), ownerId, viewerId));
}

/** All distinct tags and recent merchants - autocomplete in the expense form. */
export async function recentSuggestions(uid: string): Promise<{ merchants: string[]; tags: string[] }> {
  const snapshot = await userCollection(uid, "merchants").orderBy("lastUsed", "desc").limit(50).get();
  const merchants = snapshot.docs.map((d) => d.data().name as string);
  const expenses = await userCollection(uid, "expenses").orderBy("date", "desc").limit(200).select("tags").get();
  const tags = new Set<string>();
  for (const doc of expenses.docs) for (const tag of (doc.data().tags as string[]) ?? []) tags.add(tag);
  return { merchants, tags: [...tags].sort() };
}

interface Extra {
  source: ExpenseSource;
  receiptPath?: string;
  items?: ReceiptItem[];
  recurringId?: string;
}

async function withPln(input: ExpenseInput) {
  const fxRate = await rateToPln(input.currency, input.date);
  return { fxRate, amountPln: convert(input.amount, fxRate) };
}

export async function createExpense(uid: string, input: ExpenseInput, extra: Extra, id?: string): Promise<string> {
  const now = new Date().toISOString();
  const ref = id ? userCollection(uid, "expenses").doc(id) : userCollection(uid, "expenses").doc();
  await ref.set({ ...input, ...(await withPln(input)), ...extra, createdAt: now, updatedAt: now });
  await rememberMerchant(uid, input.merchant, input.categoryId);
  return ref.id;
}

/**
 * The category last chosen for a merchant. Learned from every saved
 * expense - after one correction "Rossmann" stays in the right category
 * without asking the model again.
 */
export async function rememberMerchant(uid: string, name: string, categoryId: string) {
  const key = merchantKey(name);
  if (!key) return;
  await userCollection(uid, "merchants").doc(key).set({
    name,
    categoryId,
    lastUsed: new Date().toISOString(),
  });
}

export async function knownMerchantCategory(uid: string, name: string): Promise<string | null> {
  const key = merchantKey(name);
  if (!key) return null;
  const doc = await userCollection(uid, "merchants").doc(key).get();
  return doc.exists ? (doc.data()!.categoryId as string) : null;
}

/** Points expenses of a deleted category at a replacement, in batches. */
export async function reassignCategory(uid: string, fromId: string, toId: string) {
  const snapshot = await userCollection(uid, "expenses").where("categoryId", "==", fromId).get();
  for (let i = 0; i < snapshot.docs.length; i += 400) {
    const batch = db().batch();
    for (const doc of snapshot.docs.slice(i, i + 400)) batch.update(doc.ref, { categoryId: toId });
    await batch.commit();
  }
}

export async function receiptInUse(uid: string, receiptPath: string): Promise<boolean> {
  const snapshot = await userCollection(uid, "expenses").where("receiptPath", "==", receiptPath).limit(1).get();
  return !snapshot.empty;
}

/**
 * Product names the user already has, most recent first. Sent to the model
 * with every receipt so "marchew" stays "marchew" instead of drifting into
 * "marchewka" - otherwise per-product statistics would split.
 */
export async function knownProducts(uid: string, limit = 300): Promise<string[]> {
  const snapshot = await userCollection(uid, "products").orderBy("lastUsed", "desc").limit(limit).get();
  return snapshot.docs.map((d) => d.data().name as string);
}

export async function rememberProducts(uid: string, items: { product?: string; group?: string }[]) {
  const now = new Date().toISOString();
  const unique = new Map(items.filter((i) => i.product).map((i) => [merchantKey(i.product!), i]));
  await Promise.all(
    [...unique.entries()]
      .filter(([key]) => key)
      .map(([key, item]) => userCollection(uid, "products").doc(key).set({ name: item.product, group: item.group, lastUsed: now })),
  );
}
