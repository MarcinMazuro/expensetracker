/** Server-side validation - never trust what comes from a form. */
import { isIsoDate } from "./dates";
import { isCurrency, parseAmount, type Currency } from "./money";
import { isProductGroup, isUnit } from "./product-groups";
import type { Interval, ReceiptItem } from "./types";

export function isEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Trimmed text up to maxLength; empty string when missing. */
export function optionalText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/** "Food, #weekend  ,food" -> ["food", "weekend"] */
export function parseTags(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const tags = value
    .split(/[,;]/)
    .map((t) => t.trim().replace(/^#/, "").toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 30);
  return [...new Set(tags)].slice(0, 10);
}

export interface ExpenseInput {
  amount: number;
  currency: Currency;
  date: string;
  merchant: string;
  categoryId: string;
  note: string;
  tags: string[];
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_AMOUNT = 100_000_000; // 1 000 000.00

export function parseExpenseInput(form: Record<string, unknown>, categoryIds: Set<string>): Parsed<ExpenseInput> {
  const amount = parseAmount(form.amount);
  if (amount === null || amount <= 0) return { ok: false, error: "Podaj kwotę większą od zera, np. 24,99." };
  if (amount > MAX_AMOUNT) return { ok: false, error: "Kwota jest za duża." };

  const currency = form.currency ?? "PLN";
  if (!isCurrency(currency)) return { ok: false, error: "Nieobsługiwana waluta." };

  if (!isIsoDate(form.date)) return { ok: false, error: "Podaj poprawną datę." };

  const categoryId = typeof form.categoryId === "string" ? form.categoryId : "";
  if (!categoryIds.has(categoryId)) return { ok: false, error: "Wybierz kategorię." };

  const merchant = optionalText(form.merchant, 120);
  if (!merchant) return { ok: false, error: "Podaj, gdzie lub na co wydano pieniądze." };

  return {
    ok: true,
    value: {
      amount,
      currency,
      date: form.date,
      merchant,
      categoryId,
      note: optionalText(form.note, 1000),
      tags: parseTags(form.tags),
    },
  };
}

export const INTERVALS: Record<Interval, string> = {
  weekly: "co tydzień",
  monthly: "co miesiąc",
  quarterly: "co kwartał",
  yearly: "co rok",
};

export function isInterval(value: unknown): value is Interval {
  return typeof value === "string" && value in INTERVALS;
}

/** Plain object from FormData (files skipped). */
export function formObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}

/**
 * Lines typed by hand (or edited on a receipt), sent from the form as JSON.
 * Product and group are kept when the line already has them; the server
 * fills them in for new lines.
 */
export function parseItemsJson(value: unknown, categoryIds?: Set<string>): Parsed<ReceiptItem[]> {
  if (typeof value !== "string" || value.trim() === "") return { ok: true, value: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return { ok: false, error: "Nieprawidłowe pozycje." };
  }
  if (!Array.isArray(raw) || raw.length > 150) return { ok: false, error: "Nieprawidłowe pozycje." };

  const items: ReceiptItem[] = [];
  for (const [index, row] of raw.entries()) {
    const r = (row ?? {}) as Record<string, unknown>;
    const name = optionalText(r.name, 120);
    const amount = parseAmount(r.amount);
    const quantity = typeof r.quantity === "number" ? r.quantity : Number(String(r.quantity ?? "").replace(",", "."));
    // Completely empty rows (added and left blank) are skipped
    if (!name && amount === null) continue;
    if (!name) return { ok: false, error: `Pozycja ${index + 1}: podaj nazwę.` };
    if (amount === null || amount < 0 || amount > MAX_AMOUNT) return { ok: false, error: `Pozycja „${name}”: podaj cenę, np. 4,99.` };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity >= 10_000) return { ok: false, error: `Pozycja „${name}”: podaj ilość większą od zera.` };
    items.push({
      name,
      amount,
      quantity: Math.round(quantity * 1000) / 1000,
      unit: isUnit(r.unit) ? r.unit : "szt",
      ...(typeof r.product === "string" && r.product.trim() && { product: r.product.trim().toLowerCase().slice(0, 60) }),
      ...(isProductGroup(r.group) && { group: r.group }),
      ...(typeof r.categoryId === "string" && (!categoryIds || categoryIds.has(r.categoryId)) && { categoryId: r.categoryId }),
    });
  }
  return { ok: true, value: items };
}
