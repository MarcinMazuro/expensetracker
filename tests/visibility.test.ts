import { describe, expect, it } from "vitest";
import { formatDateTimeShort, fromWarsawInput, toWarsawInput } from "@/lib/dates";
import { toTheme } from "@/lib/theme";
import { isHiddenNow, isVisibleTo, parseHidden } from "@/lib/visibility";

const now = new Date("2026-11-07T12:00:00Z");

describe("who sees a hidden expense", () => {
  it("shows ordinary expenses to everyone", () => {
    expect(isVisibleTo({}, "owner", "other", now)).toBe(true);
  });

  it("hides until the owner reveals it by hand", () => {
    expect(isVisibleTo({ hidden: true }, "owner", "other", now)).toBe(false);
    expect(isVisibleTo({ hidden: true }, "owner", "owner", now)).toBe(true);
  });

  it("reveals by itself once the set moment passes", () => {
    const timed = { hidden: true, hiddenUntil: "2026-11-07T12:00:01.000Z" };
    expect(isVisibleTo(timed, "owner", "other", now)).toBe(false);
    expect(isVisibleTo(timed, "owner", "other", new Date("2026-11-07T12:00:01Z"))).toBe(true);
    expect(isHiddenNow(timed, new Date("2026-12-01T00:00:00Z"))).toBe(false);
  });
});

describe("hidden settings from a form", () => {
  it("is off unless ticked", () => {
    expect(parseHidden({}, false, now)).toEqual({ ok: true, value: null });
    expect(parseHidden({ hiddenMode: "time", hiddenUntil: "bad" }, false, now)).toEqual({ ok: true, value: null });
  });

  it("hides until a click by default", () => {
    expect(parseHidden({ hidden: "on", hiddenMode: "manual" }, false, now)).toEqual({ ok: true, value: { whole: true } });
  });

  it("reads the reveal time as Polish time", () => {
    expect(parseHidden({ hidden: "on", hiddenMode: "time", hiddenUntil: "2026-12-24T18:00" }, false, now))
      .toEqual({ ok: true, value: { whole: true, until: "2026-12-24T17:00:00.000Z" } });
  });

  it("rejects a missing or past reveal time", () => {
    expect(parseHidden({ hidden: "on", hiddenMode: "time", hiddenUntil: "" }, false, now).ok).toBe(false);
    expect(parseHidden({ hidden: "on", hiddenMode: "time", hiddenUntil: "2026-01-01T10:00" }, false, now).ok).toBe(false);
  });
});

describe("Polish wall-clock time", () => {
  it("handles winter and summer time and round-trips", () => {
    expect(fromWarsawInput("2026-07-01T12:00")).toBe("2026-07-01T10:00:00.000Z");
    expect(fromWarsawInput("2026-01-01T12:00")).toBe("2026-01-01T11:00:00.000Z");
    expect(toWarsawInput("2026-12-24T17:00:00.000Z")).toBe("2026-12-24T18:00");
    expect(formatDateTimeShort("2026-12-24T17:00:00.000Z")).toContain("18:00");
  });

  it("rejects nonsense and an hour skipped by the clock change", () => {
    expect(fromWarsawInput("2026-13-01T10:00")).toBeNull();
    expect(fromWarsawInput("tomorrow")).toBeNull();
    expect(fromWarsawInput("2026-03-29T02:30")).toBeNull();
  });
});

describe("themes", () => {
  it("falls back to automatic for anything unknown", () => {
    expect(toTheme("hearts")).toBe("hearts");
    expect(toTheme("constructor")).toBe("auto");
    expect(toTheme(undefined)).toBe("auto");
  });
});
