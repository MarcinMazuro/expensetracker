/**
 * Money is stored as integers in minor units (grosze, cents) - never as
 * floats, so totals of hundreds of expenses do not drift.
 */

export const BASE_CURRENCY = "PLN";

export const CURRENCIES = ["PLN", "EUR", "USD", "GBP", "CHF", "CZK", "NOK", "SEK", "DKK", "HUF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Parses what people actually type: "12,50", "12.5", "1 234,56", "1,234.56", "-3".
 * Returns minor units, or null when the input is not a sensible amount.
 */
export function parseAmount(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;

  let value = input.replace(/[\s ]/g, "").replace(/(zł|pln|eur|usd|€|\$)/gi, "");
  if (!/^-?[\d.,]+$/.test(value)) return null;

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const decimals = decimalIndex === -1 ? 0 : value.length - decimalIndex - 1;

  if (decimalIndex !== -1 && decimals <= 2) {
    // The last separator is the decimal one, all earlier ones group thousands
    const whole = value.slice(0, decimalIndex).replace(/[.,]/g, "");
    value = `${whole}.${value.slice(decimalIndex + 1)}`;
  } else {
    // "1.234" or "1,234,567" - only thousands separators
    if (decimalIndex !== -1 && decimals !== 3) return null;
    value = value.replace(/[.,]/g, "");
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

const formatters = new Map<string, Intl.NumberFormat>();

/** 1234.5 PLN -> "1 234,50 zł" */
export function formatMoney(minor: number, currency: string = BASE_CURRENCY): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency });
    formatters.set(currency, formatter);
  }
  return formatter.format(minor / 100);
}

/** Compact form for charts and tiles: "1,2 tys. zł" */
export function formatMoneyShort(minor: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: BASE_CURRENCY,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(minor / 100);
}

/** Minor units -> value for an <input>, e.g. 1250 -> "12,50" */
export function toInputValue(minor: number): string {
  return (minor / 100).toFixed(2).replace(".", ",");
}

/** Converts using a rate expressed as PLN per one unit of the foreign currency. */
export function convert(minor: number, rate: number): number {
  return Math.round(minor * rate);
}
