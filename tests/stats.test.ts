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
    expect(pace(expenses, "2026-11", "2026-11-02")).toEqual({ spent: 5000, elapsedDays: 2, days: 30, dailyAverage: 2500, projected: 75000, fixed: 0 });
    expect(pace(expenses, "2026-11", "2026-12-15").projected).toBe(5000);
  });

  describe("recurring charges in forecasts", () => {
    const room = { ...expense("2026-11-06", 134000, "home", "Pokój"), source: "recurring" as const };

    it("spreads a monthly charge over the whole month instead of extrapolating it", () => {
      expect(pace([room], "2026-11", "2026-11-06")).toMatchObject({ spent: 134000, projected: 134000, dailyAverage: 4467, fixed: 134000 });
    });

    it("extrapolates only everyday spending", () => {
      const groceries = expense("2026-11-02", 6000);
      expect(pace([room, groceries], "2026-11", "2026-11-06")).toMatchObject({ spent: 140000, projected: 134000 + 30000, dailyAverage: 5467 });
    });

    it("includes charges still to come, before they are booked", () => {
      expect(pace([], "2026-11", "2026-11-06", [{ categoryId: "home", amountPln: 134000 }])).toMatchObject({ spent: 0, projected: 134000, dailyAverage: 4467 });
    });

    it("averages a finished month over all its days", () => {
      expect(pace([room], "2026-11", "2026-12-15")).toMatchObject({ projected: 134000, dailyAverage: 4467 });
    });

    it("does not raise a budget warning for a charge that fits", () => {
      const [home] = budgets([category("home", 150000)], [room], "2026-11", "2026-11-06");
      expect(home).toMatchObject({ projected: 134000, state: "warning" }); // 89% used, under budget at month end
      const [ok] = budgets([category("home", 200000)], [room], "2026-11", "2026-11-06");
      expect(ok).toMatchObject({ projected: 134000, state: "ok" });
    });

    it("counts a charge coming later in the category forecast", () => {
      const [home] = budgets([category("home", 100000)], [], "2026-11", "2026-11-06", [{ categoryId: "home", amountPln: 134000 }]);
      expect(home).toMatchObject({ spent: 0, projected: 134000, state: "warning" });
    });
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
