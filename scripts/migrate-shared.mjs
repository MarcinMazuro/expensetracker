#!/usr/bin/env node
/**
 * One-off: brings shared expenses saved before custom splits up to the
 * current shape. Every copy gets `shared.home` (the payer, who kept the full
 * version), the copy of whoever owes money gets `unsettled: true`, and the
 * full list of lines stays only on the home copy.
 *
 *   node scripts/migrate-shared.mjs [database]            # dry run
 *   node scripts/migrate-shared.mjs [database] --apply
 *
 * Safe to run again: copies that already have `shared.home` are skipped.
 */
import { FieldValue, Firestore } from "@google-cloud/firestore";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const databaseId = args.find((a) => !a.startsWith("--")) ?? "(default)";
const db = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "expensetracker-mm", databaseId });

const users = await db.collection("users").get();
let changed = 0;
for (const user of users.docs) {
  const expenses = await user.ref.collection("expenses").get();
  let shared = 0;
  let debts = 0;
  for (const doc of expenses.docs) {
    const data = doc.data();
    if (!data.shared || data.shared.home) continue;
    shared++;
    const home = data.shared.paidBy;
    const owes = user.id !== home && data.amount > 0 && !data.shared.settled;
    if (owes) debts++;
    if (apply) {
      await doc.ref.update({
        "shared.home": home,
        ...(user.id !== home && { "shared.items": FieldValue.delete() }),
        ...(owes && { unsettled: true }),
      });
    }
    changed++;
  }
  console.log(`${user.id.slice(0, 6)}...: ${expenses.size} expenses, ${shared} shared to migrate, ${debts} marked as to pay back`);
}
console.log(apply ? `Updated ${changed} document(s) in "${databaseId}".` : `Dry run on "${databaseId}": ${changed} document(s) would change. Add --apply to write.`);
