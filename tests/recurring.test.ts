import { describe, expect, it } from "vitest";
import { chargesInMonth, dueDates, monthlyEquivalent, nextOccurrence } from "@/lib/recurring-schedule";

describe("recurring schedule", () => {
  it("books every missed charge and returns the next future one", () => {
    expect(dueDates("2026-09-15", "monthly", 15, "2026-11-02")).toEqual({
      due: ["2026-09-15", "2026-10-15"],
      next: "2026-11-15",
    });
  });

  it("books a charge due today", () => {
    expect(dueDates("2026-11-02", "weekly", 2, "2026-11-02").due).toEqual(["2026-11-02"]);
  });

  it("books nothing for a future date", () => {
    expect(dueDates("2026-12-01", "yearly", 1, "2026-11-02")).toEqual({ due: [], next: "2026-12-01" });
  });

  it("caps runaway catch-up", () => {
    expect(dueDates("2000-01-01", "weekly", 1, "2026-11-02").due).toHaveLength(60);
  });

  it("follows the anchor day of month-end subscriptions", () => {
    expect(nextOccurrence("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    expect(nextOccurrence("2026-11-30", "quarterly", 30)).toBe("2027-02-28");
  });

  it("counts charges not booked yet in a month", () => {
    expect(chargesInMonth("2026-11-20", "monthly", 20, "2026-11")).toBe(1);
    expect(chargesInMonth("2026-12-06", "monthly", 6, "2026-11")).toBe(0);
    expect(chargesInMonth("2026-11-09", "weekly", 9, "2026-11")).toBe(4);
    expect(chargesInMonth("2026-11-06", "monthly", 6, "2027-01")).toBe(1);
  });

  it("estimates the monthly cost", () => {
    expect(monthlyEquivalent(12000, "yearly")).toBe(1000);
    expect(monthlyEquivalent(1000, "weekly")).toBe(4333);
  });
});
