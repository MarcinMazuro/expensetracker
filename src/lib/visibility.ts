/**
 * Hidden expenses: the other person cannot see them at all until they are
 * revealed - at a set moment, or when the owner clicks. Checked when reading,
 * so a timed reveal needs no scheduler. Every read of someone else's expenses
 * goes through isVisibleTo; the owner always sees their own.
 */
import { fromWarsawInput } from "./dates";
import { convert } from "./money";
import type { Expense, ReceiptItem } from "./types";
import type { Parsed } from "./validation";

export type HiddenFields = Pick<Expense, "hidden" | "hiddenUntil">;

/** Whether the reveal time, if any, is still ahead. */
function notRevealedYet(expense: Pick<Expense, "hiddenUntil">, now: Date): boolean {
  return !expense.hiddenUntil || new Date(expense.hiddenUntil) > now;
}

/** The whole expense is hidden right now: no reveal time, or the reveal time has not come yet. */
export function isHiddenNow(expense: HiddenFields, now = new Date()): boolean {
  return expense.hidden === true && notRevealedYet(expense, now);
}

export function isVisibleTo(expense: HiddenFields, ownerId: string, viewerId: string, now = new Date()): boolean {
  return ownerId === viewerId || !isHiddenNow(expense, now);
}

/** A single line is hidden right now. Lines share the expense's reveal time. */
export function isLineHiddenNow(item: Pick<ReceiptItem, "hidden">, expense: Pick<Expense, "hiddenUntil">, now = new Date()): boolean {
  return item.hidden === true && notRevealedYet(expense, now);
}

/** Lines of the expense (its own part and, on a home copy, the full list) that are hidden right now. */
export function hiddenLines(expense: Pick<Expense, "items" | "shared" | "hiddenUntil">, now = new Date()): ReceiptItem[] {
  return (expense.shared?.items ?? expense.items ?? []).filter((i) => isLineHiddenNow(i, expense, now));
}

/**
 * An expense as someone else may see it: null when all of it is hidden,
 * otherwise without its hidden lines and with their price taken off every
 * amount. The owner sees their own expense unchanged. The receipt photo is
 * not touched - that was the owner's decision.
 */
export function projectFor(expense: Expense, ownerId: string, viewerId: string, now = new Date()): Expense | null {
  if (ownerId === viewerId) return expense;
  if (isHiddenNow(expense, now)) return null;

  const hide = (i: ReceiptItem) => isLineHiddenNow(i, expense, now);
  const own = (expense.items ?? []).filter(hide);
  const full = (expense.shared?.items ?? []).filter(hide);
  if (own.length === 0 && full.length === 0) return expense;

  const ownSum = own.reduce((s, i) => s + i.amount, 0);
  const amount = expense.amount - ownSum;
  // Nothing but hidden lines: as good as a hidden expense
  if (!expense.shared && amount <= 0) return null;

  const { hiddenUntil: _reveal, ...rest } = expense;
  void _reveal;
  return {
    ...rest,
    amount,
    amountPln: Math.max(0, expense.amountPln - convert(ownSum, expense.fxRate)),
    items: (expense.items ?? []).filter((i) => !hide(i)),
    ...(expense.shared && {
      shared: {
        ...expense.shared,
        total: expense.shared.total - full.reduce((s, i) => s + i.amount, 0),
        ...(expense.shared.items && { items: expense.shared.items.filter((i) => !hide(i)) }),
      },
    }),
  };
}

export interface HiddenSettings {
  /** The whole expense is hidden (as opposed to single lines only). */
  whole: boolean;
  /** Moment of the automatic reveal; without it only a click reveals. */
  until?: string;
}

/** The hidden settings of a form: null = nothing is hidden. They cover the whole expense and any hidden lines. */
export function parseHidden(
  form: { hidden?: unknown; hiddenMode?: unknown; hiddenUntil?: unknown },
  anyLineHidden = false,
  now = new Date(),
): Parsed<HiddenSettings | null> {
  const whole = form.hidden === "on";
  if (!whole && !anyLineHidden) return { ok: true, value: null };
  if (form.hiddenMode !== "time") return { ok: true, value: { whole } };

  const until = fromWarsawInput(form.hiddenUntil);
  if (!until) return { ok: false, error: "Podaj datę i godzinę odkrycia." };
  if (new Date(until) <= now) return { ok: false, error: "Czas odkrycia musi być w przyszłości." };
  return { ok: true, value: { whole, until } };
}
