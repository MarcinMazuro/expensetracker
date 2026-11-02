"use server";

import { revalidatePath } from "next/cache";
import { listCategories } from "@/lib/categories";
import { addDays, isIsoDate, today } from "@/lib/dates";
import { userCollection } from "@/lib/firestore";
import { isCurrency, parseAmount } from "@/lib/money";
import { bookDueRecurring } from "@/lib/recurring";
import { dueDates } from "@/lib/recurring-schedule";
import { requireUser } from "@/lib/session";
import type { RecurringExpense } from "@/lib/types";
import { isInterval, optionalText } from "@/lib/validation";
import type { FormState } from "./auth";

export async function saveRecurring(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const categoryIds = new Set((await listCategories(user.id)).map((c) => c.id));

  const name = optionalText(formData.get("name"), 80);
  const amount = parseAmount(formData.get("amount"));
  const currency = formData.get("currency");
  const interval = formData.get("interval");
  const nextDate = formData.get("nextDate");
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!name) return { error: "Podaj nazwę, np. Netflix albo czynsz." };
  if (amount === null || amount <= 0) return { error: "Podaj kwotę większą od zera." };
  if (!isCurrency(currency)) return { error: "Nieobsługiwana waluta." };
  if (!isInterval(interval)) return { error: "Wybierz, jak często." };
  if (!isIsoDate(nextDate)) return { error: "Podaj datę najbliższej płatności." };
  if (!categoryIds.has(categoryId)) return { error: "Wybierz kategorię." };

  const fields = { name, amount, currency, interval, nextDate, categoryId, anchorDay: Number(nextDate.slice(8, 10)) };
  const id = String(formData.get("id") ?? "");
  if (id) {
    await userCollection(user.id, "recurring").doc(id).update(fields);
  } else {
    await userCollection(user.id, "recurring").add({ ...fields, active: true, createdAt: new Date().toISOString() });
  }

  // A start date in the past books the missed charges right away
  const booked = await bookDueRecurring(user.id);
  revalidatePath("/", "layout");
  return { success: booked ? `Zapisano i zaksięgowano zaległe płatności: ${booked}.` : "Zapisano." };
}

export async function toggleRecurring(formData: FormData) {
  const user = await requireUser();
  const ref = userCollection(user.id, "recurring").doc(String(formData.get("id") ?? ""));
  const doc = await ref.get();
  if (!doc.exists) return;
  const rule = doc.data() as RecurringExpense;
  if (rule.active) {
    await ref.update({ active: false });
  } else {
    // Resuming does not book the charges skipped while paused
    const { next } = dueDates(rule.nextDate, rule.interval, rule.anchorDay, addDays(today(), -1), 10_000);
    await ref.update({ active: true, nextDate: next });
  }
  revalidatePath("/recurring");
}

export async function deleteRecurring(formData: FormData) {
  const user = await requireUser();
  // Already booked expenses stay - they were real payments
  await userCollection(user.id, "recurring").doc(String(formData.get("id") ?? "")).delete();
  revalidatePath("/recurring");
}
