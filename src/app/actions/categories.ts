"use server";

import { revalidatePath } from "next/cache";
import { listCategories } from "@/lib/categories";
import { reassignCategory } from "@/lib/expenses";
import { userCollection } from "@/lib/firestore";
import { parseAmount } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import type { FormState } from "./auth";

function parseCategory(formData: FormData) {
  const name = optionalText(formData.get("name"), 40);
  const emoji = optionalText(formData.get("emoji"), 8) || "📦";
  const color = String(formData.get("color") ?? "");
  const budgetText = String(formData.get("budget") ?? "").trim();
  const budget = budgetText ? parseAmount(budgetText) : 0;

  if (!name) return { error: "Podaj nazwę kategorii." } as const;
  if (!/^#[0-9a-f]{6}$/i.test(color)) return { error: "Nieprawidłowy kolor." } as const;
  if (budget === null || budget < 0) return { error: "Budżet musi być kwotą, np. 800 albo puste pole." } as const;
  return { value: { name, emoji, color, budget } } as const;
}

export async function saveCategory(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseCategory(formData);
  if ("error" in parsed) return { error: parsed.error };

  const categories = await listCategories(user.id);
  const id = String(formData.get("id") ?? "");
  const duplicate = categories.find((c) => c.name.toLowerCase() === parsed.value.name.toLowerCase() && c.id !== id);
  if (duplicate) return { error: "Kategoria o tej nazwie już istnieje." };

  if (id) {
    if (!categories.some((c) => c.id === id)) return { error: "Ta kategoria już nie istnieje." };
    await userCollection(user.id, "categories").doc(id).update(parsed.value);
  } else {
    const order = Math.max(-1, ...categories.map((c) => c.order)) + 1;
    await userCollection(user.id, "categories").add({ ...parsed.value, order });
  }
  revalidatePath("/", "layout");
  return { success: id ? "Zapisano zmiany." : "Dodano kategorię." };
}

/** Deletes a category; its expenses move to the chosen replacement. */
export async function deleteCategory(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const target = String(formData.get("target") ?? "");
  const categories = await listCategories(user.id);

  if (!categories.some((c) => c.id === id)) return { error: "Ta kategoria już nie istnieje." };
  if (categories.length <= 1) return { error: "Musi zostać co najmniej jedna kategoria." };
  if (!categories.some((c) => c.id === target) || target === id) return { error: "Wybierz, dokąd przenieść wydatki." };

  await reassignCategory(user.id, id, target);
  // Recurring charges and the merchant memory must not point at a deleted category either
  for (const name of ["recurring", "merchants"] as const) {
    const snapshot = await userCollection(user.id, name).where("categoryId", "==", id).get();
    await Promise.all(snapshot.docs.map((d) => d.ref.update({ categoryId: target })));
  }
  await userCollection(user.id, "categories").doc(id).delete();
  revalidatePath("/", "layout");
  return { success: "Usunięto kategorię." };
}

export async function moveCategory(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const categories = await listCategories(user.id);
  const index = categories.findIndex((c) => c.id === id);
  const swap = categories[index + direction];
  if (index === -1 || !swap) return;

  // Renumber everything, which also repairs gaps or duplicates in "order"
  const reordered = [...categories];
  [reordered[index], reordered[index + direction]] = [swap, reordered[index]];
  await Promise.all(reordered.map((c, order) => userCollection(user.id, "categories").doc(c.id).update({ order })));
  revalidatePath("/categories");
}
