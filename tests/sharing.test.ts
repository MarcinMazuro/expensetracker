import { describe, expect, it } from "vitest";
import { divide, isEqualSplit, normalizeWeights, parseSplit, splitByWeights, type WholeExpense } from "@/lib/sharing";
import type { Expense, ReceiptItem } from "@/lib/types";
import { hiddenLines, parseHidden, projectFor } from "@/lib/visibility";

const people = ["lion", "puma"];
const line = (name: string, amount: number, extra: Partial<ReceiptItem> = {}): ReceiptItem => ({ name, amount, quantity: 1, unit: "szt", ...extra });
const whole = (patch: Partial<WholeExpense>): WholeExpense => ({
  total: 0, items: [], shared: true, participants: people, paidBy: "lion", home: "lion", weights: { lion: 50, puma: 50 }, ...patch,
});

describe("weights", () => {
  it("accepts whole percentages that sum to 100, else falls back to equal parts", () => {
    expect(normalizeWeights(people, { lion: 70, puma: 30 })).toEqual({ lion: 70, puma: 30 });
    expect(normalizeWeights(people, { lion: 70, puma: 20 })).toEqual({ lion: 50, puma: 50 });
    expect(normalizeWeights(people, { lion: 33.5, puma: 66.5 })).toEqual({ lion: 50, puma: 50 });
    expect(normalizeWeights(["a", "b", "c"])).toEqual({ a: 34, b: 33, c: 33 });
    expect(isEqualSplit(people, { lion: 50, puma: 50 })).toBe(true);
    expect(isEqualSplit(people, { lion: 60, puma: 40 })).toBe(false);
  });

  it("always adds up, the odd grosz going to the payer", () => {
    expect(splitByWeights(10001, people, { lion: 70, puma: 30 }, "puma")).toEqual({ lion: 7000, puma: 3001 });
    expect(splitByWeights(10001, people, { lion: 100, puma: 0 }, "puma")).toEqual({ lion: 10001, puma: 0 });
    for (const total of [1, 99, 12345]) {
      for (const w of [0, 1, 33, 50, 99, 100]) {
        const parts = splitByWeights(total, people, { lion: w, puma: 100 - w }, "lion");
        expect(parts.lion + parts.puma).toBe(total);
      }
    }
  });

  it("reads split settings from a form", () => {
    expect(parseSplit({ paidBy: "puma", weights: '{"lion":25,"puma":75}' }, people, "lion")).toEqual({ paidBy: "puma", weights: { lion: 25, puma: 75 } });
    expect(parseSplit({ paidBy: "stranger", weights: "nonsense" }, people, "lion")).toEqual({ paidBy: "lion", weights: { lion: 50, puma: 50 } });
  });
});

describe("dividing an expense", () => {
  it("splits a plain amount by the percentages", () => {
    const d = divide(whole({ total: 10000, weights: { lion: 70, puma: 30 } }));
    expect(d).toMatchObject({ shared: true, holders: people });
    expect([d.parts.lion.amount, d.parts.puma.amount]).toEqual([7000, 3000]);
  });

  it("divides line by line: shared lines by weight, the rest to their owner", () => {
    const d = divide(whole({
      total: 3000,
      items: [line("Chleb", 1000), line("Krem", 1500, { assign: "puma" }), line("Piwo", 500, { assign: "lion", quantity: 2 })],
    }));
    expect(d.parts.lion.amount).toBe(500 + 500);
    expect(d.parts.puma.amount).toBe(500 + 1500);
    expect(d.parts.lion.items.map((i) => [i.name, i.amount, i.quantity])).toEqual([["Chleb", 500, 0.5], ["Piwo", 500, 2]]);
    expect(d.parts.puma.items.map((i) => i.name)).toEqual(["Chleb", "Krem"]);
    expect(d.parts.lion.amount + d.parts.puma.amount).toBe(3000);
  });

  it("splits what the lines do not cover, e.g. a receipt total that differs from them", () => {
    const d = divide(whole({ total: 1003, items: [line("Chleb", 1000, { assign: "lion" })] }));
    expect([d.parts.lion.amount, d.parts.puma.amount]).toEqual([1000 + 2, 1]);
  });

  it("keeps a hidden line with the account that owns the receipt", () => {
    const d = divide(whole({ total: 2000, items: [line("Chleb", 1000), line("Prezent", 1000, { hidden: true, assign: "puma" })] }));
    expect(d.parts.lion.items.map((i) => i.name)).toEqual(["Chleb", "Prezent"]);
    expect(d.parts.puma.items.map((i) => i.name)).toEqual(["Chleb"]);
    expect([d.parts.lion.amount, d.parts.puma.amount]).toEqual([1500, 500]);
  });

  it("is not shared when one person ends up with everything they paid for", () => {
    expect(divide(whole({ total: 1000, items: [line("Moje", 1000, { assign: "lion" })] }))).toMatchObject({ shared: false, holders: ["lion"] });
    expect(divide(whole({ total: 1000, weights: { lion: 100, puma: 0 } }))).toMatchObject({ shared: false, holders: ["lion"] });
  });

  it("stays shared when the payer bought something entirely for the other person", () => {
    const d = divide(whole({ total: 1000, items: [line("Jej buty", 1000, { assign: "puma" })] }));
    expect(d).toMatchObject({ shared: true, holders: people });
    expect([d.parts.lion.amount, d.parts.puma.amount]).toEqual([0, 1000]);
  });

  it("moves an expense someone else paid for and owns entirely to their account", () => {
    expect(divide(whole({ total: 1000, paidBy: "puma", weights: { lion: 0, puma: 100 } }))).toMatchObject({ shared: false, holders: ["puma"] });
  });

  it("gives a private expense wholly to its account, ignoring assignments", () => {
    const d = divide(whole({ shared: false, total: 1200, items: [line("A", 1000, { assign: "puma" })] }));
    expect(d).toMatchObject({ shared: false, holders: ["lion"] });
    expect(d.parts.lion.amount).toBe(1200);
  });
});

describe("what the other person sees", () => {
  const expense = (patch: Partial<Expense>): Expense => ({
    id: "e", amount: 3000, currency: "PLN", amountPln: 3000, fxRate: 1, date: "2026-11-09", merchant: "Rossmann", categoryId: "c",
    note: "", tags: [], source: "receipt", createdAt: "", updatedAt: "", ...patch,
  });
  const now = new Date("2026-11-09T12:00:00Z");
  const items = [line("Szampon", 1000), line("Perfumy", 2000, { hidden: true })];

  it("leaves the owner's view alone", () => {
    const e = expense({ items });
    expect(projectFor(e, "lion", "lion", now)).toBe(e);
  });

  it("drops hidden lines and takes their price off the amount", () => {
    const seen = projectFor(expense({ items, hiddenUntil: "2026-12-24T17:00:00.000Z" }), "lion", "puma", now)!;
    expect(seen.amount).toBe(1000);
    expect(seen.amountPln).toBe(1000);
    expect(seen.items!.map((i) => i.name)).toEqual(["Szampon"]);
    expect(seen.hiddenUntil).toBeUndefined();
  });

  it("converts the hidden part with the expense's exchange rate", () => {
    const seen = projectFor(expense({ items, currency: "EUR", fxRate: 4.3, amountPln: 12900 }), "lion", "puma", now)!;
    expect(seen.amountPln).toBe(12900 - 8600);
  });

  it("shows the lines again once the reveal time has passed", () => {
    const e = expense({ items, hiddenUntil: "2026-11-09T11:00:00.000Z" });
    expect(projectFor(e, "lion", "puma", now)).toBe(e);
    expect(hiddenLines(e, now)).toEqual([]);
  });

  it("hides an expense made only of hidden lines, and a wholly hidden one", () => {
    expect(projectFor(expense({ amount: 2000, items: [items[1]] }), "lion", "puma", now)).toBeNull();
    expect(projectFor(expense({ hidden: true }), "lion", "puma", now)).toBeNull();
  });

  it("corrects the total and the full list of a shared expense", () => {
    const shared = { total: 4000, participants: people, paidBy: "lion", home: "lion", items: [line("Chleb", 2000), items[1]] };
    const seen = projectFor(expense({ amount: 3000, items: [line("Chleb", 1000), items[1]], shared }), "lion", "puma", now)!;
    expect(seen.amount).toBe(1000);
    expect(seen.shared).toMatchObject({ total: 2000, items: [{ name: "Chleb" }] });
  });

  it("needs reveal settings as soon as a single line is hidden", () => {
    expect(parseHidden({}, false, now)).toEqual({ ok: true, value: null });
    expect(parseHidden({}, true, now)).toEqual({ ok: true, value: { whole: false } });
    expect(parseHidden({ hidden: "on", hiddenMode: "time", hiddenUntil: "2026-12-24T18:00" }, false, now))
      .toEqual({ ok: true, value: { whole: true, until: "2026-12-24T17:00:00.000Z" } });
    expect(parseHidden({ hiddenMode: "time", hiddenUntil: "2026-01-01T10:00" }, true, now).ok).toBe(false);
  });
});
