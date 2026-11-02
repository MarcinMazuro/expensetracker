import { describe, expect, it } from "vitest";
import { addMonths, daysInMonth, isIsoDate, monthRange, monthsBack, shiftMonth, today } from "@/lib/dates";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-1")).toBe(false);
    expect(isIsoDate(20260101)).toBe(false);
  });

  it("uses the Polish calendar day, not UTC", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Warsaw
    expect(today(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("handles month boundaries and leap years", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthsBack("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("keeps the anchor day across short months", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
  });
});
