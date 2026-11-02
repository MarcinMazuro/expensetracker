import type { Category, Expense } from "./types";

/** Quotes a field when needed and neutralises spreadsheet formulas (CSV injection). */
export function csvField(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const decimal = (minor: number) => (minor / 100).toFixed(2).replace(".", ",");

/**
 * Semicolon-separated with decimal commas and a BOM - opens correctly in
 * Polish Excel and in Google Sheets without an import wizard.
 */
export function expensesToCsv(expenses: Expense[], categories: Map<string, Category>): string {
  const header = ["Data", "Sklep / opis", "Kategoria", "Kwota", "Waluta", "Kwota PLN", "Kurs", "Tagi", "Notatka", "Źródło"];
  const rows = expenses.map((e) => [
    e.date,
    e.merchant,
    categories.get(e.categoryId)?.name ?? "Bez kategorii",
    decimal(e.amount),
    e.currency,
    decimal(e.amountPln),
    String(e.fxRate).replace(".", ","),
    e.tags.join(", "),
    e.note,
    { manual: "ręcznie", receipt: "paragon", recurring: "cykliczne" }[e.source],
  ]);
  return "﻿" + [header, ...rows].map((row) => row.map(csvField).join(";")).join("\r\n") + "\r\n";
}
