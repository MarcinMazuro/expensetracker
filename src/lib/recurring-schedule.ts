import { addDays, addMonths, monthRange } from "./dates";
import type { Interval } from "./types";

/** The charge date after `date`. */
export function nextOccurrence(date: string, interval: Interval, anchorDay: number): string {
  switch (interval) {
    case "weekly":
      return addDays(date, 7);
    case "monthly":
      return addMonths(date, 1, anchorDay);
    case "quarterly":
      return addMonths(date, 3, anchorDay);
    case "yearly":
      return addMonths(date, 12, anchorDay);
  }
}

/**
 * Every charge date from `nextDate` up to and including `today`, plus the
 * next date still in the future. Capped, so a subscription forgotten for
 * years cannot create thousands of expenses in one request.
 */
export function dueDates(
  nextDate: string,
  interval: Interval,
  anchorDay: number,
  today: string,
  limit = 60,
): { due: string[]; next: string } {
  const due: string[] = [];
  let cursor = nextDate;
  while (cursor <= today && due.length < limit) {
    due.push(cursor);
    cursor = nextOccurrence(cursor, interval, anchorDay);
  }
  return { due, next: cursor };
}

/** How many charges not booked yet fall in the given month. */
export function chargesInMonth(nextDate: string, interval: Interval, anchorDay: number, month: string): number {
  return dueDates(nextDate, interval, anchorDay, monthRange(month).to, 1000).due.filter((d) => d.startsWith(month)).length;
}

/** Rough monthly cost, for the "subscriptions cost you X a month" summary. */
export function monthlyEquivalent(amount: number, interval: Interval): number {
  const perMonth = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[interval];
  return Math.round(amount * perMonth);
}
