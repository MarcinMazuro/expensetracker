import { matchesQuery } from "./text";
import type { Expense } from "./types";

export interface ExpenseFilters {
  category?: string;
  q?: string;
  tag?: string;
}

/** Applied in memory to one month of expenses - no extra Firestore indexes needed. */
export function filterExpenses(expenses: Expense[], { category, q, tag }: ExpenseFilters): Expense[] {
  return expenses.filter(
    (e) =>
      (!category || e.categoryId === category) &&
      (!tag || e.tags.includes(tag)) &&
      (!q || matchesQuery(`${e.merchant} ${e.note} ${e.tags.join(" ")} ${(e.items ?? []).map((i) => i.name).join(" ")}`, q)),
  );
}

/** Expenses grouped by day, newest day first. */
export function groupByDay(expenses: Expense[]): { date: string; expenses: Expense[]; total: number }[] {
  const groups = new Map<string, Expense[]>();
  for (const e of expenses) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, list]) => ({ date, expenses: list, total: list.reduce((s, e) => s + e.amountPln, 0) }));
}
