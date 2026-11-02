import { describe, expect, it } from "vitest";
import { normalizeReceipt, receiptJsonSchema, splitByCategory } from "@/lib/ai/receipt-schema";

const ids = new Set(["food", "home", "other"]);

describe("normalizeReceipt", () => {
  const raw = {
    isReceipt: true,
    merchant: " BIEDRONKA ",
    date: "2026-10-30",
    currency: "pln",
    total: 55.1,
    items: [
      { name: "Mleko", amount: 7.98, categoryId: "food" },
      { name: "Masło", amount: 6.99, categoryId: "food" },
      { name: "Fairy", amount: 12.99, categoryId: "home" },
      { name: "Papier", amount: 17.49, categoryId: "made-up" },
      { name: "Jabłka", amount: 4.16, categoryId: "food" },
      { name: "Chleb", amount: 5.49, categoryId: "food" },
    ],
  };

  it("converts to minor units and validates categories", () => {
    const draft = normalizeReceipt(raw, ids, "other", "2026-11-02")!;
    expect(draft.merchant).toBe("BIEDRONKA");
    expect(draft.currency).toBe("PLN");
    expect(draft.total).toBe(5510);
    // Unknown category falls back; missing product fields get safe defaults
    expect(draft.items[3]).toEqual({ name: "Papier", amount: 1749, categoryId: "other", product: "papier", quantity: 1, unit: "szt", group: "other" });
    expect(draft.mismatch).toBe(false);
  });

  it("flags a line sum that does not match the total", () => {
    expect(normalizeReceipt({ ...raw, total: 80 }, ids, "other", "2026-11-02")!.mismatch).toBe(true);
  });

  it("replaces a future or broken date with today", () => {
    expect(normalizeReceipt({ ...raw, date: "2027-01-01" }, ids, "other", "2026-11-02")!.date).toBe("2026-11-02");
    expect(normalizeReceipt({ ...raw, date: "30.10.2026" }, ids, "other", "2026-11-02")!.date).toBe("2026-11-02");
  });

  it("rejects non-receipts and garbage", () => {
    expect(normalizeReceipt({ ...raw, isReceipt: false }, ids, "other", "2026-11-02")).toBeNull();
    expect(normalizeReceipt("nope", ids, "other", "2026-11-02")).toBeNull();
    expect(normalizeReceipt({ total: 0, items: [] }, ids, "other", "2026-11-02")).toBeNull();
  });

  it("falls back to the line sum when the total is missing", () => {
    expect(normalizeReceipt({ ...raw, total: null }, ids, "other", "2026-11-02")!.total).toBe(5510);
  });

  it("restricts the model to the user's category ids", () => {
    const schema = receiptJsonSchema(["a", "b"]);
    expect(schema.properties.items.items.properties.categoryId.enum).toEqual(["a", "b"]);
  });
});

describe("splitByCategory", () => {
  it("groups lines and gives the rounding difference to the largest group", () => {
    const groups = splitByCategory({
      total: 1003,
      items: [
        { name: "a", amount: 600, categoryId: "food" },
        { name: "b", amount: 300, categoryId: "home" },
        { name: "c", amount: 100, categoryId: "food" },
      ],
    });
    expect(groups.map((g) => [g.categoryId, g.amount, g.items.length])).toEqual([["food", 703, 2], ["home", 300, 1]]);
    expect(groups.reduce((s, g) => s + g.amount, 0)).toBe(1003);
  });
});
