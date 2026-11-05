import { describe, expect, it } from "vitest";
import { settle, splitAmount, splitItems } from "@/lib/split";

describe("splitting a shared expense", () => {
  it("halves an even amount", () => {
    expect(splitAmount(10000, 2, 0)).toEqual([5000, 5000]);
  });

  it("gives the odd grosz to the payer and always adds up", () => {
    expect(splitAmount(10001, 2, 1)).toEqual([5000, 5001]);
    for (const total of [1, 99, 12345, 100003]) {
      for (const payer of [0, 1, 2]) expect(splitAmount(total, 3, payer).reduce((a, b) => a + b)).toBe(total);
    }
  });

  it("splits receipt lines, quantities included", () => {
    const items = [{ name: "Marchew", amount: 333, product: "marchew", quantity: 1.5, unit: "kg" as const, group: "vegetables" as const }];
    expect(splitItems(items, 2, 0, 0)[0]).toMatchObject({ amount: 167, quantity: 0.75 });
    expect(splitItems(items, 2, 1, 0)[0]).toMatchObject({ amount: 166, quantity: 0.75 });
  });
});

describe("settling up", () => {
  it("each person owes the payer their share, netted between two people", () => {
    expect(settle([
      { owner: "lion", paidBy: "lion", amount: 5000 },
      { owner: "puma", paidBy: "lion", amount: 5000 },
      { owner: "lion", paidBy: "puma", amount: 1200 },
      { owner: "puma", paidBy: "puma", amount: 1200 },
    ])).toEqual([{ from: "puma", to: "lion", amount: 3800 }]);
  });

  it("is empty when everything evens out", () => {
    expect(settle([
      { owner: "puma", paidBy: "lion", amount: 2000 },
      { owner: "lion", paidBy: "puma", amount: 2000 },
    ])).toEqual([]);
  });
});
