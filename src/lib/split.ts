/**
 * Splitting a shared expense equally. Amounts are integers in minor units,
 * so 100,01 zł between two people is 50,01 + 50,00 - the odd grosz goes to
 * the person who paid, and the shares always add up to the total exactly.
 */
import type { ReceiptItem } from "./types";

export function splitAmount(total: number, people: number, payerIndex: number): number[] {
  const base = Math.floor(total / people);
  const remainder = total - base * people;
  return Array.from({ length: people }, (_, i) => base + (i === payerIndex ? remainder : 0));
}

/** One person's part of every line: amounts split like the total, quantities divided. */
export function splitItems(items: ReceiptItem[], people: number, index: number, payerIndex: number): ReceiptItem[] {
  return items.map((item) => ({
    ...item,
    amount: splitAmount(item.amount, people, payerIndex)[index],
    ...(item.quantity !== undefined && { quantity: Math.round((item.quantity / people) * 1000) / 1000 }),
  }));
}

export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/**
 * Who owes whom for shared expenses: each person owes the payer their own
 * share. Debts in both directions are netted, so two people get one line.
 */
export function settle(shares: { owner: string; paidBy: string; amount: number }[]): Debt[] {
  const net = new Map<string, number>();
  for (const s of shares) {
    if (s.owner === s.paidBy) continue;
    const [a, b] = [s.owner, s.paidBy].sort();
    const key = `${a}|${b}`;
    // Positive: a owes b
    net.set(key, (net.get(key) ?? 0) + (s.owner === a ? s.amount : -s.amount));
  }
  return [...net.entries()]
    .filter(([, v]) => v !== 0)
    .map(([key, v]) => {
      const [a, b] = key.split("|");
      return v > 0 ? { from: a, to: b, amount: v } : { from: b, to: a, amount: -v };
    });
}
