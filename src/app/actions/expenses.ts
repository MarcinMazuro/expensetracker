"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { suggestCategory } from "@/lib/ai/gemini";
import { listCategories } from "@/lib/categories";
import { completeItems, removeExpenseEverywhere, revealHidden, setSettled, writeExpense } from "@/lib/expense-writer";
import { getVisibleExpense, knownMerchantCategory, listUnsettled, receiptInUse } from "@/lib/expenses";
import { toInputValue } from "@/lib/money";
import { isRateLimited } from "@/lib/protection";
import { flash } from "@/lib/flash";
import { ownerQuery, resolveOwner } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { parseSplit } from "@/lib/sharing";
import { activeUsers } from "@/lib/users";
import { deleteReceiptFile } from "@/lib/storage";
import { formObject, parseExpenseInput, parseItemsJson } from "@/lib/validation";
import { parseHidden } from "@/lib/visibility";
import type { FormState } from "./auth";

export async function saveExpense(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  // The expense may belong to the other person - they share full access
  const { owner, people } = await resolveOwner(user, formData.get("owner"));
  const categoryIds = new Set((await listCategories(owner.id)).map((c) => c.id));
  const items = parseItemsJson(formData.get("items"), categoryIds);
  if (!items.ok) return { error: items.error };

  const form = formObject(formData);
  // With lines, the amount is their sum - the form shows it, the server recomputes it
  if (items.value.length > 0) form.amount = toInputValue(items.value.reduce((s, i) => s + i.amount, 0));
  const parsed = parseExpenseInput(form, categoryIds);
  if (!parsed.ok) return { error: parsed.error };

  const shared = formData.get("shared") === "on";
  // The writer applies hiding only for whoever owns the full version; here it is just validated
  const hidden = parseHidden(form, items.value.some((i) => i.hidden));
  if (!hidden.ok) return { error: hidden.error };
  if (hidden.value?.whole && shared) return { error: "Wydatek wspólny nie może być ukryty w całości - ukryj pojedyncze pozycje." };
  const split = parseSplit(form, people.map((p) => p.id), user.id);

  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  try {
    if (id && !(await getVisibleExpense(user.id, owner.id, id))) return { error: "Ten wydatek już nie istnieje." };
    if (items.value.length > 0 && isRateLimited(`classify:${user.id}`, { max: 120, seconds: 3600 })) {
      return { error: "Za dużo zapisów z pozycjami w ciągu godziny. Spróbuj za chwilę." };
    }
    await writeExpense(owner, parsed.value, {
      id: id || undefined,
      editedBy: user.id,
      shared,
      // A new expense has no stored split to fall back on
      split: shared ? split : undefined,
      hidden: hidden.value,
      source: "manual",
      items: items.value.length > 0 ? await completeItems(owner.id, items.value) : id ? [] : undefined,
    });
  } catch (error) {
    console.error("Saving expense failed:", error);
    return { error: "Nie udało się zapisać. Jeśli to waluta obca, kurs NBP mógł być chwilowo niedostępny." };
  }

  revalidatePath("/", "layout");
  // "Save and add another" keeps the form open for a series of receipts
  if (formData.get("intent") !== "another") await flash(id ? "Zapisano zmiany" : "Zapisano wydatek");
  if (formData.get("intent") === "another") {
    return { success: `Zapisano: ${parsed.value.merchant}. Dodaj kolejny.` };
  }
  redirect(`/expenses?month=${parsed.value.date.slice(0, 7)}${ownerQuery(user, owner, "&")}`);
}

export async function removeExpense(formData: FormData) {
  const user = await requireUser();
  const { owner } = await resolveOwner(user, formData.get("owner"));
  const id = String(formData.get("id") ?? "");
  // Somebody else's hidden expense behaves as if it did not exist
  const expense = (await getVisibleExpense(user.id, owner.id, id)) ? await removeExpenseEverywhere(owner, id) : null;
  if (expense?.receiptPath) {
    // A receipt split by category (or shared) is used by several expenses -
    // the photo goes only with the last of them
    const owners = expense.shared?.participants ?? [owner.id];
    const stillUsed = await Promise.all(owners.map((uid) => receiptInUse(uid, expense.receiptPath!)));
    if (!stillUsed.some(Boolean)) await deleteReceiptFile(expense.receiptPath);
  }
  if (expense) await flash("Usunięto wydatek");
  revalidatePath("/", "layout");
  redirect(`/expenses?month=${(expense?.date ?? "").slice(0, 7)}${ownerQuery(user, owner, "&")}`);
}

/** Shows everything hidden in an expense to the other person now. Only for its owner: the path is the viewer's own. */
export async function revealExpense(formData: FormData) {
  const user = await requireUser();
  await revealHidden(user.id, String(formData.get("id") ?? ""));
  await flash("Odkryte");
  revalidatePath("/", "layout");
}

/** "Oddane": marks the debt of one shared expense as paid back, or takes that back. Either person may click it. */
export async function settleExpense(formData: FormData) {
  const user = await requireUser();
  const { owner } = await resolveOwner(user, formData.get("owner"));
  const id = String(formData.get("id") ?? "");
  const settled = formData.get("settled") !== "off";
  if (await getVisibleExpense(user.id, owner.id, id)) {
    await setSettled(owner.id, id, settled, user.id);
    await flash(settled ? "Oddane" : "Cofnięto oddanie", settled ? "party" : "ok");
  }
  revalidatePath("/", "layout");
}

/** "Wszystko oddane": every outstanding debt between the people is marked as paid back. */
export async function settleAll() {
  const user = await requireUser();
  const people = await activeUsers();
  for (const person of people) {
    for (const expense of await listUnsettled(person.id)) await setSettled(person.id, expense.id, true, user.id);
  }
  await flash("Wszystko oddane", "party");
  revalidatePath("/", "layout");
}

/**
 * Category for the merchant typed in the form: first from what the user
 * chose for it before, then from Gemini.
 */
export async function suggestCategoryFor(merchant: string, note: string, ownerId?: string): Promise<{ categoryId: string | null; source: "memory" | "ai" | null }> {
  const viewer = await requireUser();
  // Suggestions come from the owner's categories and merchant memory
  const { owner: user } = await resolveOwner(viewer, ownerId);
  const name = merchant.trim().slice(0, 120);
  if (name.length < 2) return { categoryId: null, source: null };

  const remembered = await knownMerchantCategory(user.id, name);
  if (remembered) return { categoryId: remembered, source: "memory" };

  if (isRateLimited(`suggest:${user.id}`, { max: 60, seconds: 3600 })) return { categoryId: null, source: null };
  try {
    const categoryId = await suggestCategory(name, note.slice(0, 300), await listCategories(user.id));
    return { categoryId, source: categoryId ? "ai" : null };
  } catch (error) {
    console.error("Category suggestion failed:", error);
    return { categoryId: null, source: null };
  }
}
