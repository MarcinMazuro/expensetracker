/**
 * Aggregations for the dashboard and reports. Pure functions over a list of
 * expenses - a few people produce hundreds of expenses a month, so summing
 * in memory is simpler and cheaper than maintaining counters in Firestore.
 */
import { daysInMonth, monthRange } from "./dates";
import type { Category, Expense } from "./types";

export function total(expenses: Pick<Expense, "amountPln">[]): number {
  return expenses.reduce((sum, e) => sum + e.amountPln, 0);
}

export interface CategoryTotal {
  categoryId: string;
  total: number;
  count: number;
  share: number;
}

/** Totals per category, largest first. */
export function byCategory(expenses: Expense[]): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const e of expenses) {
    const entry = map.get(e.categoryId) ?? { total: 0, count: 0 };
    entry.total += e.amountPln;
    entry.count++;
    map.set(e.categoryId, entry);
  }
  const sum = total(expenses);
  return [...map.entries()]
    .map(([categoryId, v]) => ({ categoryId, ...v, share: sum ? v.total / sum : 0 }))
    .sort((a, b) => b.total - a.total);
}

/** Spending for every day of the month (zeros included), for the bar chart. */
export function dailySeries(expenses: Expense[], month: string): { date: string; total: number }[] {
  const { from } = monthRange(month);
  const days = daysInMonth(month);
  const totals = new Array<number>(days).fill(0);
  for (const e of expenses) {
    if (!e.date.startsWith(month)) continue;
    totals[Number(e.date.slice(8, 10)) - 1] += e.amountPln;
  }
  return totals.map((t, i) => ({ date: `${from.slice(0, 8)}${String(i + 1).padStart(2, "0")}`, total: t }));
}

export function monthlyTotals(expenses: Expense[], months: string[]): { month: string; total: number }[] {
  const map = new Map(months.map((m) => [m, 0]));
  for (const e of expenses) {
    const m = e.date.slice(0, 7);
    if (map.has(m)) map.set(m, map.get(m)! + e.amountPln);
  }
  return months.map((month) => ({ month, total: map.get(month)! }));
}

/** month -> categoryId -> total, for the report heatmap. */
export function categoryByMonth(expenses: Expense[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const e of expenses) {
    const m = e.date.slice(0, 7);
    const row = result.get(e.categoryId) ?? new Map<string, number>();
    row.set(m, (row.get(m) ?? 0) + e.amountPln);
    result.set(e.categoryId, row);
  }
  return result;
}

export function topMerchants(expenses: Expense[], limit = 5): { merchant: string; total: number; count: number }[] {
  const map = new Map<string, { merchant: string; total: number; count: number }>();
  for (const e of expenses) {
    const key = e.merchant.toLowerCase();
    const entry = map.get(key) ?? { merchant: e.merchant, total: 0, count: 0 };
    entry.total += e.amountPln;
    entry.count++;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export interface Pace {
  spent: number;
  /** Days of the month that have passed, including today. */
  elapsedDays: number;
  days: number;
  dailyAverage: number;
  /** Linear projection of the month-end total. */
  projected: number;
}

/**
 * How fast the month is going. For a past month the projection equals the
 * total, for a future month there is nothing to project.
 */
export function pace(expenses: Expense[], month: string, today: string): Pace {
  const days = daysInMonth(month);
  const spent = total(expenses.filter((e) => e.date.startsWith(month)));
  const currentMonth = today.slice(0, 7);
  const elapsedDays = month < currentMonth ? days : month > currentMonth ? 0 : Number(today.slice(8, 10));
  const dailyAverage = elapsedDays ? Math.round(spent / elapsedDays) : 0;
  const projected = elapsedDays ? Math.round((spent / elapsedDays) * days) : spent;
  return { spent, elapsedDays, days, dailyAverage, projected };
}

export type BudgetState = "ok" | "warning" | "over";

export interface BudgetStatus {
  category: Category;
  spent: number;
  budget: number;
  ratio: number;
  state: BudgetState;
  /** Where spending will land at the current pace - warns before it happens. */
  projected: number;
}

/** Budget usage for categories that have a budget, most used first. */
export function budgets(categories: Category[], expenses: Expense[], month: string, today: string): BudgetStatus[] {
  const totals = new Map(byCategory(expenses.filter((e) => e.date.startsWith(month))).map((c) => [c.categoryId, c.total]));
  const { elapsedDays, days } = pace(expenses, month, today);

  return categories
    .filter((c) => c.budget > 0)
    .map((category) => {
      const spent = totals.get(category.id) ?? 0;
      const ratio = spent / category.budget;
      const projected = elapsedDays ? Math.round((spent / elapsedDays) * days) : spent;
      const state: BudgetState = ratio >= 1 ? "over" : ratio >= 0.8 || projected > category.budget ? "warning" : "ok";
      return { category, spent, budget: category.budget, ratio, state, projected };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

/** Relative change, e.g. 0.12 for +12%. Null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

/** Spending by weekday, Monday first - "weekends cost me the most". */
export function byWeekday(expenses: Expense[]): number[] {
  const totals = new Array<number>(7).fill(0);
  for (const e of expenses) {
    const day = new Date(`${e.date}T00:00:00Z`).getUTCDay();
    totals[(day + 6) % 7] += e.amountPln;
  }
  return totals;
}
