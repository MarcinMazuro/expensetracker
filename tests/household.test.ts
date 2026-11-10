import { describe, expect, it } from "vitest";
import { inMonth } from "@/lib/dates";
import { compareCategories, cumulativeByPerson, insights, monthlyByPerson, personTotals, sharedFeed, type Member } from "@/lib/household";
import type { Category, Expense, User } from "@/lib/types";

const user = (id: string, name: string): User => ({ id, name, email: `${id}@x.pl`, role: "member", disabled: false, sessionVersion: 1, createdAt: "", color: "#000" });
const category = (id: string, name: string): Category => ({ id, name, emoji: "•", color: "#111", budget: 0, order: 0 });
const expense = (id: string, date: string, amountPln: number, categoryId: string, merchant = "Sklep"): Expense => ({
  id, amount: amountPln, currency: "PLN", amountPln, fxRate: 1, date, merchant, categoryId, note: "", tags: [], source: "manual", createdAt: date, updatedAt: date,
});

// Category ids differ per person - they are matched by name
const members: Member[] = [
  { user: user("m", "Marcin"), categories: [category("m-food", "Spożywcze"), category("m-car", "Transport")],
    expenses: [expense("1", "2026-11-01", 10000, "m-food"), expense("2", "2026-11-03", 30000, "m-car", "Orlen"), expense("3", "2026-10-10", 20000, "m-food")] },
  { user: user("a", "Agnieszka"), categories: [category("a-food", "spożywcze")],
    expenses: [expense("4", "2026-11-02", 20000, "a-food", "Lidl"), expense("5", "2026-10-11", 20000, "a-food")] },
];

describe("household", () => {
  it("splits the month between people", () => {
    expect(personTotals(members, "2026-11").map((p) => [p.user.name, p.total, p.share, p.previous])).toEqual([
      ["Marcin", 40000, 2 / 3, 20000],
      ["Agnieszka", 20000, 1 / 3, 20000],
    ]);
  });

  it("matches categories by name across people", () => {
    expect(compareCategories(members, "2026-11").map((c) => [c.name, c.amounts, c.total])).toEqual([
      ["Spożywcze", { m: 10000, a: 20000 }, 30000],
      ["Transport", { m: 30000 }, 30000],
    ]);
  });

  it("compares the current month with the same days of the previous one", () => {
    // Agnieszka's October expense is on the 11th - after the 3rd, so it does not count yet
    expect(personTotals(members, "2026-11", "2026-11-03").map((p) => p.previous)).toEqual([0, 0]);
    expect(personTotals(members, "2026-11", "2026-11-12").map((p) => p.previous)).toEqual([20000, 20000]);
  });

  it("builds running totals up to today only", () => {
    const [marcin, agnieszka] = cumulativeByPerson(members, "2026-11", "2026-11-03");
    expect(marcin.points).toEqual([10000, 10000, 40000]);
    expect(agnieszka.points).toEqual([0, 20000, 20000]);
    expect(cumulativeByPerson(members, "2026-10", "2026-11-03")[0].points).toHaveLength(31);
  });

  it("stacks months per person and merges the feed", () => {
    expect(monthlyByPerson(members, ["2026-10", "2026-11"])).toEqual([
      { month: "2026-10", amounts: { m: 20000, a: 20000 }, total: 40000 },
      { month: "2026-11", amounts: { m: 40000, a: 20000 }, total: 60000 },
    ]);
    expect(sharedFeed(members, "2026-11").map((f) => f.expense.id)).toEqual(["2", "4", "1"]);
  });

  it("shows a shared expense once, at its full amount, and settles who owes whom", async () => {
    const { settlement } = await import("@/lib/household");
    const shared = { total: 10000, participants: ["m", "a"], paidBy: "m" };
    const withShared: Member[] = [
      { ...members[0], expenses: [...members[0].expenses, { ...expense("s1", "2026-11-04", 5000, "m-food", "Kaufland"), shared }] },
      { ...members[1], expenses: [...members[1].expenses, { ...expense("s1", "2026-11-04", 5000, "a-food", "Kaufland"), shared }] },
    ];
    const feed = sharedFeed(withShared, "2026-11");
    expect(feed[0]).toMatchObject({ amountPln: 10000, paidBy: { id: "m" } });
    expect(feed[0].users.map((u) => u.id)).toEqual(["m", "a"]);
    expect(feed).toHaveLength(4);
    const debtor = [{ user: withShared[1].user, expenses: withShared[1].expenses.filter((e) => e.shared) }];
    const result = settlement(debtor, withShared.map((m) => m.user));
    expect(result.debts).toEqual([{ from: "a", to: "m", amount: 5000 }]);
    expect(result.lines).toMatchObject([{ id: "s1", merchant: "Kaufland", amountPln: 5000 }]);
  });

  it("writes plain-language insights", () => {
    const text = insights(members, "2026-11").map((i) => i.text).join("\n");
    expect(text).toContain("o 50% więcej");
    expect(text).toContain("Marcin wydaje więcej na transport");
    expect(text).toContain("Największy wydatek: Orlen");
  });

  it("names the month in the locative", () => {
    expect(inMonth("2026-11", new Date("2026-11-05"))).toBe("w listopadzie");
    expect(inMonth("2025-02", new Date("2026-11-05"))).toBe("w lutym 2025");
  });
});
