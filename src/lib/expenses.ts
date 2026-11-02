import "server-only";
import { db, userCollection } from "./firestore";
import { rateToPln } from "./fx";
import { convert } from "./money";
import { merchantKey } from "./text";
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

export async function updateExpense(uid: string, id: string, input: ExpenseInput) {
  await userCollection(uid, "expenses")
    .doc(id)
    .update({ ...input, ...(await withPln(input)), updatedAt: new Date().toISOString() });
  await rememberMerchant(uid, input.merchant, input.categoryId);
}

export async function deleteExpense(uid: string, id: string) {
  await userCollection(uid, "expenses").doc(id).delete();
}

/**
 * The category last chosen for a merchant. Learned from every saved
 * expense - after one correction "Rossmann" stays in the right category
 * without asking the model again.
 */
async function rememberMerchant(uid: string, name: string, categoryId: string) {
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
