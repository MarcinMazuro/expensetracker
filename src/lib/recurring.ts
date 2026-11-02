import "server-only";
import { today } from "./dates";
import { createExpense } from "./expenses";
import { userCollection } from "./firestore";
import { dueDates } from "./recurring-schedule";
import type { RecurringExpense } from "./types";

export async function listRecurring(uid: string): Promise<RecurringExpense[]> {
  const snapshot = await userCollection(uid, "recurring").orderBy("nextDate").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as RecurringExpense);
}

/**
 * Books every recurring charge that fell due since the last visit. Runs when
 * the user opens the app, so no scheduler is needed. Expense IDs are derived
 * from the rule and the date, so two tabs opened at once cannot book the
 * same charge twice - the second write just overwrites the first.
 */
export async function bookDueRecurring(uid: string): Promise<number> {
  const now = today();
  const snapshot = await userCollection(uid, "recurring")
    .where("nextDate", "<=", now)
    .get();

  let booked = 0;
  for (const doc of snapshot.docs) {
    // Filtered here rather than in the query, which would need a composite index
    if (doc.data().active !== true) continue;
    const rule = { id: doc.id, ...doc.data() } as RecurringExpense;
    const { due, next } = dueDates(rule.nextDate, rule.interval, rule.anchorDay, now);

    for (const date of due) {
      await createExpense(
        uid,
        {
          amount: rule.amount,
          currency: rule.currency,
          date,
          merchant: rule.name,
          categoryId: rule.categoryId,
          note: "",
          tags: ["cykliczne"],
        },
        { source: "recurring", recurringId: rule.id },
        `recurring_${rule.id}_${date}`,
      );
      booked++;
    }
    await doc.ref.update({ nextDate: next });
  }
  return booked;
}
