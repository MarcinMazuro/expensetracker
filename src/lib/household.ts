/**
 * The shared view: everyone's expenses side by side. Pure functions over
 * each member's expenses and categories. Categories are per person, so they
 * are matched by name ("Spożywcze" is the same thing for both).
 */
import { daysInMonth, shiftMonth } from "./dates";
import { settle } from "./split";
import { total } from "./stats";
import type { Category, Expense, User } from "./types";

export interface Member {
  user: User;
  expenses: Expense[];
  categories: Category[];
}

export interface PersonTotal {
  user: User;
  total: number;
  share: number;
  count: number;
  previous: number;
}

const inMonth = (expenses: Expense[], month: string) => expenses.filter((e) => e.date.startsWith(month));

/**
 * The previous month up to the same day - in the current month, the 1st-5th
 * is compared with the 1st-5th, not with a whole month.
 */
function previousPeriod(expenses: Expense[], month: string, today?: string): Expense[] {
  const previousMonth = shiftMonth(month, -1);
  const previous = inMonth(expenses, previousMonth);
  if (!today?.startsWith(month)) return previous;
  const cutoff = `${previousMonth}-${today.slice(8, 10)}`;
  return previous.filter((e) => e.date <= cutoff);
}

/** Who spent how much this month, and their share of the whole. */
export function personTotals(members: Member[], month: string, today?: string): PersonTotal[] {
  const rows = members.map((m) => {
    const current = inMonth(m.expenses, month);
    return { user: m.user, total: total(current), count: current.length, previous: total(previousPeriod(m.expenses, month, today)) };
  });
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({ ...r, share: sum ? r.total / sum : 0 }));
}

/**
 * Running total per day for each person - the lines of the "race" chart.
 * Stops at today in the current month, so the lines do not flatten into
 * the future.
 */
export function cumulativeByPerson(members: Member[], month: string, today: string): { user: User; points: number[] }[] {
  const days = daysInMonth(month);
  const lastDay = today.startsWith(month) ? Number(today.slice(8, 10)) : month > today.slice(0, 7) ? 0 : days;
  return members.map((m) => {
    const daily = new Array<number>(days).fill(0);
    for (const e of inMonth(m.expenses, month)) daily[Number(e.date.slice(8, 10)) - 1] += e.amountPln;
    const points: number[] = [];
    let running = 0;
    for (let d = 0; d < lastDay; d++) points.push((running += daily[d]));
    return { user: m.user, points };
  });
}

export interface CategoryComparison {
  name: string;
  emoji: string;
  color: string;
  /** user id -> PLN minor units */
  amounts: Record<string, number>;
  total: number;
}

/** Spending per category name for each person, largest combined first. */
export function compareCategories(members: Member[], month: string): CategoryComparison[] {
  const rows = new Map<string, CategoryComparison>();
  for (const m of members) {
    const byId = new Map(m.categories.map((c) => [c.id, c]));
    for (const e of inMonth(m.expenses, month)) {
      const category = byId.get(e.categoryId);
      const name = category?.name ?? "Bez kategorii";
      const key = name.toLowerCase();
      const row = rows.get(key) ?? { name, emoji: category?.emoji ?? "❔", color: category?.color ?? "#a8a29e", amounts: {}, total: 0 };
      row.amounts[m.user.id] = (row.amounts[m.user.id] ?? 0) + e.amountPln;
      row.total += e.amountPln;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.total - a.total);
}

/** Each person's total in each of the given months, for the stacked trend. */
export function monthlyByPerson(members: Member[], months: string[]): { month: string; amounts: Record<string, number>; total: number }[] {
  return months.map((month) => {
    const amounts = Object.fromEntries(members.map((m) => [m.user.id, total(inMonth(m.expenses, month))]));
    return { month, amounts, total: Object.values(amounts).reduce((s, v) => s + v, 0) };
  });
}

export interface FeedEntry {
  expense: Expense;
  category?: Category;
  /** Who it belongs to - both people for a shared expense. */
  users: User[];
  paidBy: User;
  /** The whole amount: a shared expense is shown once, not as two halves. */
  amountPln: number;
}

/** Everyone's latest expenses in one feed; the copies of a shared expense merge into one entry. */
export function sharedFeed(members: Member[], month: string, limit = 12): FeedEntry[] {
  const entries = new Map<string, FeedEntry>();
  const byId = new Map(members.map((m) => [m.user.id, m.user]));
  for (const m of members) {
    const categories = new Map(m.categories.map((c) => [c.id, c]));
    for (const expense of inMonth(m.expenses, month)) {
      const key = expense.shared ? `shared:${expense.id}` : `${m.user.id}:${expense.id}`;
      const existing = entries.get(key);
      if (existing) {
        existing.amountPln += expense.amountPln;
        if (!existing.users.includes(m.user)) existing.users.push(m.user);
        continue;
      }
      const paidBy = (expense.shared && byId.get(expense.shared.paidBy)) || m.user;
      // Show the payer's category for a shared expense, when it is the payer's copy
      entries.set(key, { expense, category: categories.get(expense.categoryId), users: [m.user], paidBy, amountPln: expense.amountPln });
    }
  }
  return [...entries.values()]
    .sort((a, b) => b.expense.date.localeCompare(a.expense.date) || b.expense.createdAt.localeCompare(a.expense.createdAt))
    .slice(0, limit);
}

export interface DebtLine {
  id: string;
  /** Who owes. */
  from: User;
  /** Who paid. */
  to: User;
  amountPln: number;
  merchant: string;
  date: string;
}

/**
 * Everything not paid back yet, whatever the month: each unsettled copy is
 * its owner's debt to whoever paid. Debts in both directions are netted.
 */
export function settlement(unsettled: { user: User; expenses: Expense[] }[], users: User[]) {
  const byId = new Map(users.map((u) => [u.id, u]));
  const lines: DebtLine[] = unsettled
    .flatMap(({ user, expenses }) =>
      expenses.flatMap((e) => {
        const to = e.shared && byId.get(e.shared.paidBy);
        return to && to.id !== user.id ? [{ id: e.id, from: user, to, amountPln: e.amountPln, merchant: e.merchant, date: e.date }] : [];
      }),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const debts = settle(lines.map((l) => ({ owner: l.from.id, paidBy: l.to.id, amount: l.amountPln })));
  return { debts, lines };
}

export interface Insight {
  emoji: string;
  text: string;
}

const pln = (minor: number) =>
  new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(minor / 100);

/** A few plain-language observations about the month - the "so what" of the charts. */
export function insights(members: Member[], month: string, today?: string): Insight[] {
  const result: Insight[] = [];
  const people = personTotals(members, month, today);
  const partial = Boolean(today?.startsWith(month));
  const combined = people.reduce((s, p) => s + p.total, 0);
  const previous = people.reduce((s, p) => s + p.previous, 0);
  if (combined === 0) return result;

  if (previous > 0) {
    const change = (combined - previous) / previous;
    if (Math.abs(change) >= 0.03) {
      result.push(change > 0
        ? { emoji: "📈", text: `Razem wydajecie o ${Math.round(change * 100)}% więcej niż ${partial ? "w tym samym okresie poprzedniego miesiąca" : "w poprzednim miesiącu"}.` }
        : { emoji: "📉", text: `Razem wydajecie o ${Math.round(-change * 100)}% mniej niż ${partial ? "w tym samym okresie poprzedniego miesiąca" : "w poprzednim miesiącu"}.` });
    }
  }

  const categories = compareCategories(members, month);
  if (categories[0]) {
    result.push({ emoji: categories[0].emoji, text: `Najwięcej idzie na: ${categories[0].name} - ${pln(categories[0].total)}, czyli ${Math.round((categories[0].total / combined) * 100)}% wspólnych wydatków.` });
  }

  if (people.length === 2) {
    // The category where the two differ the most, in either direction
    const [a, b] = people;
    const gap = categories
      .map((c) => ({ c, diff: (c.amounts[a.user.id] ?? 0) - (c.amounts[b.user.id] ?? 0) }))
      .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))[0];
    if (gap && Math.abs(gap.diff) >= 2000) {
      const more = gap.diff > 0 ? a.user : b.user;
      result.push({ emoji: "⚖️", text: `${more.name} wydaje więcej na ${gap.c.name.toLowerCase()} - o ${pln(Math.abs(gap.diff))}.` });
    }
  }

  const biggest = members
    .flatMap((m) => inMonth(m.expenses, month).map((e) => ({ user: m.user, e })))
    .sort((x, y) => y.e.amountPln - x.e.amountPln)[0];
  if (biggest) result.push({ emoji: "💸", text: `Największy wydatek: ${biggest.e.merchant}, ${pln(biggest.e.amountPln)} (${biggest.user.name}).` });

  return result;
}
