"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { suggestCategory } from "@/lib/ai/gemini";
import { listCategories } from "@/lib/categories";
import { completeItems, removeExpenseEverywhere, writeExpense } from "@/lib/expense-writer";
import { getExpense, knownMerchantCategory, receiptInUse } from "@/lib/expenses";
import { toInputValue } from "@/lib/money";
import { isRateLimited } from "@/lib/protection";
import { ownerQuery, resolveOwner } from "@/lib/people";
import { requireUser } from "@/lib/session";
import { deleteReceiptFile } from "@/lib/storage";
import { formObject, parseExpenseInput, parseItemsJson } from "@/lib/validation";
import type { FormState } from "./auth";

export async function saveExpense(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  // The expense may belong to the other person - they share full access
  const { owner } = await resolveOwner(user, formData.get("owner"));
  const categoryIds = new Set((await listCategories(owner.id)).map((c) => c.id));
  const items = parseItemsJson(formData.get("items"), categoryIds);
  if (!items.ok) return { error: items.error };

  const form = formObject(formData);
  // With lines, the amount is their sum - the form shows it, the server recomputes it
  if (items.value.length > 0) form.amount = toInputValue(items.value.reduce((s, i) => s + i.amount, 0));
  const parsed = parseExpenseInput(form, categoryIds);
  if (!parsed.ok) return { error: parsed.error };

  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  try {
    if (id && !(await getExpense(owner.id, id))) return { error: "Ten wydatek już nie istnieje." };
    if (items.value.length > 0 && isRateLimited(`classify:${user.id}`, { max: 120, seconds: 3600 })) {
      return { error: "Za dużo zapisów z pozycjami w ciągu godziny. Spróbuj za chwilę." };
    }
    await writeExpense(owner, parsed.value, {
      id: id || undefined,
      editedBy: user.id,
      shared: formData.get("shared") === "on",
      source: "manual",
      items: items.value.length > 0 ? await completeItems(owner.id, items.value) : id ? [] : undefined,
    });
  } catch (error) {
    console.error("Saving expense failed:", error);
    return { error: "Nie udało się zapisać. Jeśli to waluta obca, kurs NBP mógł być chwilowo niedostępny." };
  }

  revalidatePath("/", "layout");
  // "Save and add another" keeps the form open for a series of receipts
  if (formData.get("intent") === "another") {
    return { success: `Zapisano: ${parsed.value.merchant}. Dodaj kolejny.` };
  }
  redirect(`/expenses?month=${parsed.value.date.slice(0, 7)}${ownerQuery(user, owner, "&")}`);
}

export async function removeExpense(formData: FormData) {
  const user = await requireUser();
  const { owner } = await resolveOwner(user, formData.get("owner"));
  const expense = await removeExpenseEverywhere(owner, String(formData.get("id") ?? ""));
  if (expense?.receiptPath) {
    // A receipt split by category (or shared) is used by several expenses -
    // the photo goes only with the last of them
    const owners = expense.shared?.participants ?? [owner.id];
    const stillUsed = await Promise.all(owners.map((uid) => receiptInUse(uid, expense.receiptPath!)));
    if (!stillUsed.some(Boolean)) await deleteReceiptFile(expense.receiptPath);
  }
  revalidatePath("/", "layout");
  redirect(`/expenses?month=${(expense?.date ?? "").slice(0, 7)}${ownerQuery(user, owner, "&")}`);
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
