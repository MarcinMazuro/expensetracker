import { describe, expect, it } from "vitest";
import { budgets, byCategory, byWeekday, change, dailySeries, monthlyTotals, pace, topMerchants } from "@/lib/stats";
import type { Category, Expense } from "@/lib/types";

const expense = (date: string, amountPln: number, categoryId = "food", merchant = "Biedronka"): Expense => ({
  id: `${date}-${amountPln}`, amount: amountPln, currency: "PLN", amountPln, fxRate: 1, date, merchant, categoryId,
  note: "", tags: [], source: "manual", createdAt: "", updatedAt: "",
});

const category = (id: string, budget: number): Category => ({ id, name: id, emoji: "", color: "#000", budget, order: 0 });

describe("stats", () => {
  const expenses = [
    expense("2026-11-01", 1000),
    expense("2026-11-01", 3000, "fuel", "Orlen"),
    expense("2026-11-02", 1000, "food", "biedronka"),
  ];

  it("totals by category with shares", () => {
    expect(byCategory(expenses)).toEqual([
      { categoryId: "fuel", total: 3000, count: 1, share: 0.6 },
      { categoryId: "food", total: 2000, count: 2, share: 0.4 },
    ]);
  });

  it("fills every day of the month", () => {
    const series = dailySeries(expenses, "2026-11");
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: "2026-11-01", total: 4000 });
    expect(series[29]).toEqual({ date: "2026-11-30", total: 0 });
  });

  it("projects the month end from the current pace", () => {
    expect(pace(expenses, "2026-11", "2026-11-02")).toEqual({ spent: 5000, elapsedDays: 2, days: 30, dailyAverage: 2500, projected: 75000 });
    expect(pace(expenses, "2026-11", "2026-12-15").projected).toBe(5000);
  });

  it("warns before a budget is exceeded", () => {
    const result = budgets([category("food", 10000), category("fuel", 3000), category("none", 0)], expenses, "2026-11", "2026-11-02");
    expect(result.map((b) => [b.category.id, b.state])).toEqual([["fuel", "over"], ["food", "warning"]]);
  });

  it("merges merchants case-insensitively", () => {
    expect(topMerchants(expenses)[0]).toEqual({ merchant: "Orlen", total: 3000, count: 1 });
    expect(topMerchants(expenses)[1].count).toBe(2);
  });

  it("sums months and weekdays", () => {
    expect(monthlyTotals(expenses, ["2026-10", "2026-11"])).toEqual([{ month: "2026-10", total: 0 }, { month: "2026-11", total: 5000 }]);
    // 2026-11-01 is a Sunday, 2026-11-02 a Monday
    expect(byWeekday(expenses)).toEqual([1000, 0, 0, 0, 0, 0, 4000]);
  });

  it("computes relative change", () => {
    expect(change(120, 100)).toBeCloseTo(0.2);
    expect(change(5, 0)).toBeNull();
  });
});
