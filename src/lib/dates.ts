/**
 * Dates are stored as "YYYY-MM-DD" strings in the Europe/Warsaw calendar.
 * A receipt from 23:30 belongs to that day, whatever the server's time zone,
 * and strings sort and compare correctly in Firestore range queries.
 */

export const TIME_ZONE = "Europe/Warsaw";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function isIsoMonth(value: unknown): value is string {
  return typeof value === "string" && ISO_MONTH.test(value) && isIsoDate(`${value}-01`);
}

/** Today's date in Poland. */
export function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function currentMonth(now = new Date()): string {
  return today(now).slice(0, 7);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** First and last day of a month, inclusive. */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${month}-${String(daysInMonth(month)).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** The last `count` months ending with `month`, oldest first. */
export function monthsBack(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1));
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Adds months while keeping the day of month when possible: a subscription
 * billed on the 31st lands on the last day of shorter months.
 */
export function addMonths(date: string, months: number, anchorDay = Number(date.slice(8, 10))): string {
  const target = shiftMonth(date.slice(0, 7), months);
  const day = Math.min(anchorDay, daysInMonth(target));
  return `${target}-${String(day).padStart(2, "0")}`;
}

const monthNames = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("pl-PL", { month: "short", timeZone: "UTC" });
const dayNames = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dayShort = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-11" -> "listopad 2026" */
export function formatMonth(month: string): string {
  return monthNames.format(new Date(`${month}-01T00:00:00Z`));
}

/** "2026-11" -> "lis" */
export function formatMonthShort(month: string): string {
  return monthShort.format(new Date(`${month}-01T00:00:00Z`)).replace(".", "");
}

/** "2026-11-02" -> "poniedziałek, 2 listopada" */
export function formatDay(date: string): string {
  return dayNames.format(new Date(`${date}T00:00:00Z`));
}

/** "2026-11-02" -> "2 lis" */
export function formatDayShort(date: string): string {
  return dayShort.format(new Date(`${date}T00:00:00Z`));
}

const LOCATIVE = ["styczniu", "lutym", "marcu", "kwietniu", "maju", "czerwcu", "lipcu", "sierpniu", "wrześniu", "październiku", "listopadzie", "grudniu"];

/** "2026-11" -> "w listopadzie" (with the year when it is not the current one) */
export function inMonth(month: string, now = new Date()): string {
  const name = LOCATIVE[Number(month.slice(5, 7)) - 1];
  return month.slice(0, 4) === today(now).slice(0, 4) ? `w ${name}` : `w ${name} ${month.slice(0, 4)}`;
}
