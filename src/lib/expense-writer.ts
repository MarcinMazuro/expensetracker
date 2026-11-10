import "server-only";
import { classifyItems } from "./ai/gemini";
import { normalizeProductName } from "./ai/receipt-schema";
import { listCategories } from "./categories";
import { rememberMerchant, rememberProducts } from "./expenses";
import { userCollection } from "./firestore";
import { rateToPln } from "./fx";
import { convert } from "./money";
import { isProductGroup } from "./product-groups";
import { divide, normalizeWeights, type Weights } from "./sharing";
import { merchantKey } from "./text";
import type { Expense, ExpenseSource, ReceiptItem, SharedInfo, User } from "./types";
import { activeUsers } from "./users";
import type { ExpenseInput } from "./validation";
import { hiddenLines, isLineHiddenNow, type HiddenSettings } from "./visibility";

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

type Stored = Omit<Expense, "id">;

const expenseRef = (uid: string, id: string) => userCollection(uid, "expenses").doc(id);

async function read(uid: string, id: string): Promise<Stored | undefined> {
  return (await expenseRef(uid, id).get()).data() as Stored | undefined;
}

/** The account whose copy keeps the full version of an expense stored in `account`. */
export function homeOf(expense: Pick<Expense, "shared"> | undefined, account: string): string {
  return expense?.shared ? (expense.shared.home ?? expense.shared.paidBy) : account;
}

export interface WriteOptions {
  /** Existing expense id when editing; new expenses get a fresh id. */
  id?: string;
  shared: boolean;
  /** Who paid and the percentages, when shared. Missing: what the expense had, else the person saving and equal parts. */
  split?: { paidBy: string; weights: Weights };
  source: ExpenseSource;
  /** Every line as the person saving sees it (lines hidden from them are kept by the server). */
  items?: ReceiptItem[];
  receiptPath?: string;
  /** Who made the change, when it is not the account's owner. */
  editedBy?: string;
  /** Hidden settings; null clears them, undefined keeps what the expense has. */
  hidden?: HiddenSettings | null;
}

/**
 * Creates or updates an expense, edited through the copy in `account`.
 *
 * The full version (every line, who it belongs to, what is hidden) lives in
 * one account - the "home", whoever added it. From it every participant
 * gets a copy under the SAME document id with their own amount and their
 * part of each line, in their own category of the same name. So an edit or
 * delete from either account reaches every copy, and the shared view sums
 * the copies back to the whole.
 *
 * Lines hidden from the person saving never reach their form, so they are
 * put back here; only the home account can hide anything.
 */
export async function writeExpense(account: User, input: ExpenseInput, options: WriteOptions): Promise<{ id: string; participants: string[] }> {
  const ref = options.id ? expenseRef(account.id, options.id) : userCollection(account.id, "expenses").doc();
  const id = ref.id;
  const actor = options.editedBy ?? account.id;
  const previous = options.id ? ((await ref.get()).data() as Stored | undefined) : undefined;
  const home = homeOf(previous, account.id);
  const canonical = home === account.id ? previous : ((await read(home, id)) ?? previous);
  const now = new Date();

  // Lines: what was sent, plus the ones the sender could not see
  const kept = actor !== home && canonical ? hiddenLines(canonical, now) : [];
  const sent = (options.items ?? []).map((item): ReceiptItem => {
    if (actor === home) return item;
    const { hidden: _hidden, ...visible } = item;
    void _hidden;
    return visible;
  });
  const total = input.amount + kept.reduce((s, i) => s + i.amount, 0);

  const participants = options.shared ? (canonical?.shared?.participants ?? (await householdIds())) : [home];
  for (const uid of [home, account.id]) if (options.shared && !participants.includes(uid)) participants.push(uid);
  const paidBy = options.shared
    ? options.split && participants.includes(options.split.paidBy) ? options.split.paidBy : (canonical?.shared?.paidBy ?? actor)
    : home;
  const weights = normalizeWeights(participants, options.split?.weights ?? canonical?.shared?.weights);
  const lines = [...sent, ...kept].map((item): ReceiptItem => {
    if (!options.shared) {
      const { assign: _assign, ...rest } = item;
      void _assign;
      return rest;
    }
    return item.hidden ? { ...item, assign: home } : item;
  });

  const division = divide({ total, items: lines, shared: options.shared, participants, paidBy, home, weights });
  const holders = division.holders;
  // If the home account is left without a copy, the full version moves to whoever holds it
  const newHome = holders.includes(home) ? home : division.shared ? paidBy : holders[0];

  // Hiding belongs to the home account; anyone else's edit keeps what was set
  const mayHide = actor === home && newHome === home;
  const anyLineHidden = lines.some((i) => i.hidden);
  let hiddenWhole = canonical?.hidden === true;
  let hiddenUntil = canonical?.hiddenUntil;
  if (mayHide && options.hidden !== undefined) {
    hiddenWhole = options.hidden?.whole === true;
    hiddenUntil = options.hidden?.until;
  }
  // A shared expense is in the other account too, so it cannot be hidden as a whole
  if (division.shared || newHome !== home) hiddenWhole = false;
  if (!hiddenWhole && !anyLineHidden) hiddenUntil = undefined;
  const hiddenSum = lines.filter((i) => isLineHiddenNow(i, { hiddenUntil }, now)).reduce((s, i) => s + i.amount, 0);

  const stamp = now.toISOString();
  const fxRate = await rateToPln(input.currency, input.date);
  const accountCategory = (await listCategories(account.id)).find((c) => c.id === input.categoryId);
  const settled = canonical?.shared?.settled === true && division.shared;

  await Promise.all(
    holders.map(async (uid) => {
      const existing = uid === account.id ? previous : await read(uid, id);
      // The same category by name in the other person's list; else what they had; else "Inne"
      let categoryId = input.categoryId;
      if (uid !== account.id) {
        const theirs = await listCategories(uid);
        categoryId =
          theirs.find((c) => c.name.toLowerCase() === accountCategory?.name.toLowerCase())?.id ??
          existing?.categoryId ??
          theirs.find((c) => c.name === "Inne")?.id ??
          theirs[0]?.id ??
          input.categoryId;
      }
      const part = division.parts[uid];
      const isHome = uid === newHome;
      const shared: SharedInfo | undefined = division.shared
        ? {
            // The other person's copy must not give away the price of what is hidden from them
            total: isHome ? total : total - hiddenSum,
            participants: holders,
            paidBy,
            home: newHome,
            weights,
            ...(isHome && lines.length > 0 && { items: lines }),
            ...(settled && { settled: true, settledAt: canonical?.shared?.settledAt, settledBy: canonical?.shared?.settledBy }),
          }
        : undefined;
      const items = part.items.map((item) => (uid === account.id ? item : { ...item, categoryId }));
      const receiptPath = options.receiptPath ?? existing?.receiptPath ?? canonical?.receiptPath;

      await expenseRef(uid, id).set({
        ...input,
        categoryId,
        amount: part.amount,
        fxRate,
        amountPln: convert(part.amount, fxRate),
        source: existing?.source ?? canonical?.source ?? options.source,
        ...(receiptPath && { receiptPath }),
        ...(existing?.recurringId && { recurringId: existing.recurringId }),
        ...(items.length > 0 && { items }),
        ...(shared && { shared }),
        ...(division.shared && uid !== paidBy && part.amount > 0 && !settled && { unsettled: true }),
        ...(isHome && hiddenWhole && { hidden: true }),
        ...(isHome && hiddenUntil && { hiddenUntil }),
        createdAt: existing?.createdAt ?? canonical?.createdAt ?? stamp,
        updatedAt: stamp,
        updatedBy: actor,
      });
      // Memories feed suggestions, so what is hidden leaves no trace there
      if (!(isHome && hiddenWhole)) {
        await rememberMerchant(uid, input.merchant, categoryId);
        await rememberProducts(uid, items.filter((i) => !i.hidden));
      }
    }),
  );

  // Copies of people who no longer take part go away
  const before = new Set([...(previous?.shared?.participants ?? []), ...(canonical?.shared?.participants ?? []), account.id, home]);
  await Promise.all([...before].filter((uid) => !holders.includes(uid)).map((uid) => expenseRef(uid, id).delete()));
  return { id, participants: holders };
}

/** Deletes an expense and, if it was shared, every copy of it. Returns it, e.g. for its receipt photo. */
export async function removeExpenseEverywhere(account: User, id: string): Promise<Expense | null> {
  const data = await read(account.id, id);
  if (!data) return null;
  const owners = new Set([...(data.shared?.participants ?? []), homeOf(data, account.id), account.id]);
  await Promise.all([...owners].map((uid) => expenseRef(uid, id).delete()));
  return { id, ...data };
}

const unhide = (items?: ReceiptItem[]) =>
  items?.map((item) => {
    const { hidden: _hidden, ...rest } = item;
    void _hidden;
    return rest;
  });

/**
 * Shows everything hidden in an expense of `uid` - the expense itself and
 * any hidden lines - and lets the other copies know the real total.
 */
export async function revealHidden(uid: string, id: string) {
  const data = await read(uid, id);
  if (!data) return;
  const { hidden: _hidden, hiddenUntil: _until, ...rest } = data;
  void _hidden;
  void _until;
  await expenseRef(uid, id).set({
    ...rest,
    ...(data.items && { items: unhide(data.items) }),
    ...(data.shared && { shared: { ...data.shared, ...(data.shared.items && { items: unhide(data.shared.items) }) } }),
  });
  if (data.shared) {
    await Promise.all(
      data.shared.participants
        .filter((p) => p !== uid)
        .map(async (p) => ((await read(p, id)) ? expenseRef(p, id).update({ "shared.total": data.shared!.total }) : undefined)),
    );
  }
}

/**
 * Timed reveals that have come due are written down, so stored copies match
 * what is already shown. Runs when someone opens the app - no scheduler.
 */
export async function revealDue(uids: string[]) {
  const now = new Date().toISOString();
  await Promise.all(
    uids.map(async (uid) => {
      const due = await userCollection(uid, "expenses").where("hiddenUntil", "<=", now).get();
      await Promise.all(due.docs.map((doc) => revealHidden(uid, doc.id)));
    }),
  );
}

/** Marks the debt of a shared expense as paid back (or not), on every copy. */
export async function setSettled(account: string, id: string, settled: boolean, by: string) {
  const data = await read(account, id);
  if (!data?.shared) return;
  const stamp = new Date().toISOString();
  await Promise.all(
    data.shared.participants.map(async (uid) => {
      const copy = await read(uid, id);
      if (!copy?.shared) return;
      const { unsettled: _unsettled, ...rest } = copy;
      void _unsettled;
      const { settled: _s, settledAt: _at, settledBy: _by, ...shared } = copy.shared;
      void _s; void _at; void _by;
      await expenseRef(uid, id).set({
        ...rest,
        shared: { ...shared, ...(settled && { settled: true, settledAt: stamp, settledBy: by }) },
        ...(!settled && uid !== copy.shared.paidBy && copy.amount > 0 && { unsettled: true }),
      });
    }),
  );
}
