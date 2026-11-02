import { describe, expect, it } from "vitest";
import { normalizeProductFields, normalizeReceipt, receiptJsonSchema } from "@/lib/ai/receipt-schema";
import { formatQuantity } from "@/lib/product-groups";
import { aggregateGroups, aggregateProducts, priceByMerchant, productHistory, productKey, productLines } from "@/lib/products";
import type { Expense, ReceiptItem } from "@/lib/types";

const receipt = (id: string, date: string, merchant: string, items: ReceiptItem[], fxRate = 1): Expense => ({
  id, amount: 0, currency: fxRate === 1 ? "PLN" : "EUR", amountPln: 0, fxRate, date, merchant, categoryId: "food",
  note: "", tags: [], source: "receipt", items, createdAt: "", updatedAt: "",
});

const carrot = (quantity: number, amount: number): ReceiptItem => ({ name: "Marchew luz", amount, product: "marchew", quantity, unit: "kg", group: "vegetables" });

const expenses = [
  receipt("a", "2026-10-05", "Biedronka", [carrot(1, 399), { name: "Jabłka", amount: 500, product: "jabłka", quantity: 2, unit: "kg", group: "fruit" }]),
  receipt("b", "2026-11-02", "Lidl", [carrot(0.5, 150), { name: "Banany", amount: 600, product: "banany", quantity: 1.2, unit: "kg", group: "fruit" }]),
  receipt("c", "2026-11-03", "Biedronka", [carrot(2, 798), { name: "Mleko 1 l", amount: 798, product: "mleko", quantity: 2, unit: "l", group: "dairy" }]),
  // Saved before product fields existed
  receipt("d", "2026-11-04", "Żabka", [{ name: "  Baton  Prince Polo ", amount: 250 }]),
];

describe("product lines", () => {
  it("flattens receipt lines, falling back for old receipts", () => {
    const lines = productLines(expenses);
    expect(lines).toHaveLength(7);
    expect(lines.at(-1)).toMatchObject({ product: "baton prince polo", quantity: 1, unit: "szt", group: "other" });
  });

  it("converts foreign currency lines to PLN", () => {
    const [line] = productLines([receipt("e", "2026-11-01", "Aldi", [carrot(1, 100)], 4.3)]);
    expect(line.amountPln).toBe(430);
  });

  it("builds URL-safe keys without diacritics", () => {
    expect(productKey("pierś z kurczaka")).toBe("piers-z-kurczaka");
  });
});

describe("aggregation", () => {
  const lines = productLines(expenses);

  it("totals quantity, spend and price per kilogram for a product", () => {
    const carrotSummary = aggregateProducts(lines).find((p) => p.key === "marchew")!;
    expect(carrotSummary).toMatchObject({ spend: 1347, purchases: 3, quantities: { kg: 3.5 }, mainUnit: "kg", unitPrice: 385 });
  });

  it("answers 'how many kilograms of fruit'", () => {
    const fruit = aggregateGroups(lines.filter((l) => l.date.startsWith("2026-11"))).find((g) => g.group === "fruit")!;
    expect(fruit).toEqual({ group: "fruit", spend: 600, quantities: { kg: 1.2 }, products: 1 });
  });

  it("tracks a product month by month", () => {
    const history = productHistory(lines.filter((l) => l.key === "marchew"), ["2026-10", "2026-11"], "kg");
    expect(history).toEqual([
      { month: "2026-10", quantity: 1, spend: 399, unitPrice: 399 },
      { month: "2026-11", quantity: 2.5, spend: 948, unitPrice: 379 },
    ]);
  });

  it("finds the cheapest shop", () => {
    const shops = priceByMerchant(lines.filter((l) => l.key === "marchew"), "kg");
    expect(shops.map((s) => [s.merchant, s.unitPrice])).toEqual([["Lidl", 300], ["Biedronka", 399]]);
  });
});

describe("product fields from the model", () => {
  it("validates units, groups and quantities", () => {
    expect(normalizeProductFields({ product: "  MARCHEW ", quantity: 0.834, unit: "kg", group: "vegetables" }, "x"))
      .toEqual({ product: "marchew", quantity: 0.834, unit: "kg", group: "vegetables" });
    expect(normalizeProductFields({ product: "", quantity: -2, unit: "g", group: "planets" }, "Chleb żytni"))
      .toEqual({ product: "chleb żytni", quantity: 1, unit: "szt", group: "other" });
  });

  it("keeps product fields through receipt normalization", () => {
    const draft = normalizeReceipt({ isReceipt: true, merchant: "Lidl", date: "2026-11-01", currency: "PLN", total: 3.33,
      items: [{ name: "Marchew", amount: 3.33, categoryId: "food", product: "marchew", quantity: 1, unit: "kg", group: "vegetables" }] },
    new Set(["food"]), "food", "2026-11-02")!;
    expect(draft.items[0]).toMatchObject({ product: "marchew", quantity: 1, unit: "kg", group: "vegetables" });
  });

  it("restricts units and groups in the schema", () => {
    const item = receiptJsonSchema(["food"]).properties.items.items;
    expect(item.properties.unit.enum).toEqual(["kg", "l", "szt"]);
    expect(item.required).toContain("product");
  });

  it("formats quantities the Polish way", () => {
    expect(formatQuantity(1.5, "kg")).toBe("1,5 kg");
    expect(formatQuantity(3, "szt")).toBe("3 szt.");
  });
});
