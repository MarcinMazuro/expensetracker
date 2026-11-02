"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { suggestCategory } from "@/lib/ai/gemini";
import { listCategories } from "@/lib/categories";
import { createExpense, deleteExpense, getExpense, knownMerchantCategory, receiptInUse, updateExpense } from "@/lib/expenses";
import { isRateLimited } from "@/lib/protection";
import { requireUser } from "@/lib/session";
import { deleteReceiptFile } from "@/lib/storage";
import { formObject, parseExpenseInput } from "@/lib/validation";
import type { FormState } from "./auth";

async function parse(uid: string, formData: FormData) {
  const categories = await listCategories(uid);
  return parseExpenseInput(formObject(formData), new Set(categories.map((c) => c.id)));
}

export async function saveExpense(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = await parse(user.id, formData);
  if (!parsed.ok) return { error: parsed.error };

  const id = formData.get("id");
  try {
    if (typeof id === "string" && id) {
      if (!(await getExpense(user.id, id))) return { error: "Ten wydatek już nie istnieje." };
      await updateExpense(user.id, id, parsed.value);
    } else {
      await createExpense(user.id, parsed.value, { source: "manual" });
    }
  } catch (error) {
    console.error("Saving expense failed:", error);
    return { error: "Nie udało się zapisać. Jeśli to waluta obca, kurs NBP mógł być chwilowo niedostępny." };
  }

  revalidatePath("/", "layout");
  // "Save and add another" keeps the form open for a series of receipts
  if (formData.get("intent") === "another") {
    return { success: `Zapisano: ${parsed.value.merchant}. Dodaj kolejny.` };
  }
  redirect(`/expenses?month=${parsed.value.date.slice(0, 7)}`);
}

export async function removeExpense(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const expense = await getExpense(user.id, id);
  if (expense) {
    await deleteExpense(user.id, id);
    // A receipt split by category is shared by several expenses - the photo
    // goes only with the last of them
    if (expense.receiptPath && !(await receiptInUse(user.id, expense.receiptPath))) {
      await deleteReceiptFile(expense.receiptPath);
    }
  }
  revalidatePath("/", "layout");
  redirect(`/expenses?month=${(expense?.date ?? "").slice(0, 7)}`);
}

/**
 * Category for the merchant typed in the form: first from what the user
 * chose for it before, then from Gemini.
 */
export async function suggestCategoryFor(merchant: string, note: string): Promise<{ categoryId: string | null; source: "memory" | "ai" | null }> {
  const user = await requireUser();
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
