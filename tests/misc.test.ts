import { describe, expect, it } from "vitest";
import { csvField, expensesToCsv } from "@/lib/csv";
import { filterExpenses, groupByDay } from "@/lib/filters";
import { pickRate } from "@/lib/fx-pick";
import { merchantKey } from "@/lib/text";
import type { Expense } from "@/lib/types";
import { parseExpenseInput, parseTags } from "@/lib/validation";

const expense = (patch: Partial<Expense>): Expense => ({
  id: "1", amount: 1250, currency: "PLN", amountPln: 1250, fxRate: 1, date: "2026-11-02", merchant: "Żabka",
  categoryId: "food", note: "", tags: [], source: "manual", createdAt: "", updatedAt: "", ...patch,
});

describe("validation", () => {
  const ids = new Set(["food"]);
  const valid = { amount: "12,50", currency: "PLN", date: "2026-11-02", merchant: " Żabka ", categoryId: "food", tags: "#Kawa, kawa, praca" };

  it("parses a valid form", () => {
    const result = parseExpenseInput(valid, ids);
    expect(result).toEqual({ ok: true, value: { amount: 1250, currency: "PLN", date: "2026-11-02", merchant: "Żabka", categoryId: "food", note: "", tags: ["kawa", "praca"] } });
  });

  it.each([
    [{ amount: "0" }, "kwotę"],
    [{ amount: "abc" }, "kwotę"],
    [{ currency: "BTC" }, "waluta"],
    [{ date: "2026-13-01" }, "datę"],
    [{ categoryId: "someone-elses" }, "kategorię"],
    [{ merchant: "  " }, "gdzie"],
  ])("rejects %o", (patch, message) => {
    const result = parseExpenseInput({ ...valid, ...patch }, ids);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(message);
  });

  it("deduplicates and limits tags", () => {
    expect(parseTags(Array.from({ length: 20 }, (_, i) => `t${i}`).join(","))).toHaveLength(10);
  });
});

describe("search and grouping", () => {
  const list = [
    expense({ id: "a", merchant: "Żabka", date: "2026-11-01" }),
    expense({ id: "b", merchant: "Orlen", categoryId: "fuel", tags: ["auto"] }),
    expense({ id: "c", merchant: "Lidl", items: [{ name: "Masło extra", amount: 899 }] }),
  ];

  it("matches without Polish diacritics and inside receipt items", () => {
    expect(filterExpenses(list, { q: "zabka" }).map((e) => e.id)).toEqual(["a"]);
    expect(filterExpenses(list, { q: "maslo" }).map((e) => e.id)).toEqual(["c"]);
    expect(filterExpenses(list, { tag: "auto", category: "fuel" }).map((e) => e.id)).toEqual(["b"]);
  });

  it("groups by day, newest first", () => {
    expect(groupByDay(list).map((d) => [d.date, d.total])).toEqual([["2026-11-02", 2500], ["2026-11-01", 1250]]);
  });

  it("builds a stable merchant key", () => {
    expect(merchantKey("  Łódź Kaufland/2 ")).toBe("lodz kaufland 2");
  });
});

describe("csv", () => {
  it("neutralises formulas and quotes separators", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField('a;"b"')).toBe('"a;""b"""');
  });

  it("writes a Polish-Excel friendly file", () => {
    const csv = expensesToCsv([expense({ tags: ["x"] })], new Map([["food", { id: "food", name: "Spożywcze", emoji: "", color: "", budget: 0, order: 0 }]]));
    expect(csv.startsWith("﻿Data;")).toBe(true);
    expect(csv).toContain("2026-11-02;Żabka;Spożywcze;12,50;PLN;12,50;1;x;;ręcznie");
  });
});

describe("NBP rates", () => {
  it("takes the last business day on or before the date", () => {
    const response = { rates: [{ effectiveDate: "2026-10-30", mid: 4.25 }, { effectiveDate: "2026-11-02", mid: 4.3 }] };
    expect(pickRate(response, "2026-11-01")).toBe(4.25);
    expect(pickRate(response, "2026-11-02")).toBe(4.3);
    expect(pickRate(response, "2026-10-01")).toBeNull();
  });
});

describe("items typed by hand", () => {
  it("parses rows, skips blank ones and keeps known product fields", async () => {
    const { parseItemsJson } = await import("@/lib/validation");
    const json = JSON.stringify([
      { name: "Marchew", quantity: "1,5", unit: "kg", amount: "4,49" },
      { name: "", amount: "" },
      { name: "Mleko", quantity: 2, unit: "l", amount: "7,98", product: "Mleko", group: "dairy" },
    ]);
    expect(parseItemsJson(json)).toEqual({ ok: true, value: [
      { name: "Marchew", amount: 449, quantity: 1.5, unit: "kg" },
      { name: "Mleko", amount: 798, quantity: 2, unit: "l", product: "mleko", group: "dairy" },
    ] });
  });

  it("explains what is wrong with a row", async () => {
    const { parseItemsJson } = await import("@/lib/validation");
    const bad = (row: object) => parseItemsJson(JSON.stringify([row]));
    expect(bad({ name: "Chleb", amount: "x", quantity: 1 })).toMatchObject({ ok: false, error: expect.stringContaining("cenę") });
    expect(bad({ name: "Chleb", amount: "5", quantity: 0 })).toMatchObject({ ok: false, error: expect.stringContaining("ilość") });
    expect(bad({ amount: "5", quantity: 1 })).toMatchObject({ ok: false, error: expect.stringContaining("nazwę") });
    expect(parseItemsJson("not json").ok).toBe(false);
    expect(parseItemsJson("")).toEqual({ ok: true, value: [] });
  });
});

describe("Polish plurals", () => {
  it("picks the right form", async () => {
    const { plural } = await import("@/lib/text");
    expect([1, 2, 4, 5, 12, 22, 25, 101].map((n) => plural(n, "wydatek", "wydatki", "wydatków"))).toEqual([
      "1 wydatek", "2 wydatki", "4 wydatki", "5 wydatków", "12 wydatków", "22 wydatki", "25 wydatków", "101 wydatków",
    ]);
  });
});
