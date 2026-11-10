/**
 * Dividing an expense between people. Every line of a shared expense is
 * either split by the chosen percentages or belongs to one person; amounts
 * are integers in minor units and the parts always add up to the whole -
 * the odd grosz goes to the person who paid.
 */
import type { ReceiptItem } from "./types";

/** A line is split between everyone unless it is assigned to one person. */
export const SPLIT = "split";

export type Weights = Record<string, number>;

/** Whole percentages per participant that sum to 100; anything invalid falls back to equal parts. */
export function normalizeWeights(participants: string[], weights?: Record<string, unknown> | null): Weights {
  const given = participants.map((p) => weights?.[p]);
  const valid =
    given.every((w) => typeof w === "number" && Number.isInteger(w) && w >= 0 && w <= 100) &&
    (given as number[]).reduce((s, w) => s + w, 0) === 100;
  if (valid) return Object.fromEntries(participants.map((p, i) => [p, given[i] as number]));

  const base = Math.floor(100 / participants.length);
  return Object.fromEntries(participants.map((p, i) => [p, base + (i === 0 ? 100 - base * participants.length : 0)]));
}

/** True for the default equal split - shown as "po równo" rather than as percentages. */
export function isEqualSplit(participants: string[], weights: Weights): boolean {
  const equal = normalizeWeights(participants);
  return participants.every((p) => weights[p] === equal[p]);
}

/** An amount divided by the percentages. The remainder goes to the payer (or, if they take no part, to the biggest share). */
export function splitByWeights(amount: number, participants: string[], weights: Weights, paidBy: string): Record<string, number> {
  const parts = Object.fromEntries(participants.map((p) => [p, Math.floor((amount * (weights[p] ?? 0)) / 100)]));
  const remainder = amount - Object.values(parts).reduce((s, v) => s + v, 0);
  const receiver =
    (weights[paidBy] ?? 0) > 0 && participants.includes(paidBy)
      ? paidBy
      : [...participants].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0))[0];
  parts[receiver] += remainder;
  return parts;
}

export interface WholeExpense {
  /** The whole amount, in the expense currency. */
  total: number;
  /** Every line; may be empty, and may add up to less than the total. */
  items: ReceiptItem[];
  shared: boolean;
  /** User ids in a fixed order. */
  participants: string[];
  paidBy: string;
  /** The account that keeps the full version. */
  home: string;
  weights: Weights;
}

export interface Division {
  /** False when one person ends up with everything - then it is simply their own expense. */
  shared: boolean;
  /** The accounts that get a copy: everyone with a part, plus the payer. */
  holders: string[];
  parts: Record<string, { amount: number; items: ReceiptItem[] }>;
}

/** Who a line belongs to in this expense. */
export function lineOwner(item: ReceiptItem, whole: Pick<WholeExpense, "shared" | "participants" | "home">): string {
  if (!whole.shared) return whole.home;
  // A hidden line is private to the account that keeps the full version
  if (item.hidden) return whole.home;
  return item.assign && whole.participants.includes(item.assign) ? item.assign : SPLIT;
}

/** Each person's amount and their part of every line. */
export function divide(whole: WholeExpense): Division {
  const { participants, weights, paidBy, home } = whole;
  const parts: Division["parts"] = Object.fromEntries(participants.map((p) => [p, { amount: 0, items: [] as ReceiptItem[] }]));
  if (!parts[home]) parts[home] = { amount: 0, items: [] };

  let lineSum = 0;
  for (const item of whole.items) {
    lineSum += item.amount;
    const owner = lineOwner(item, whole);
    if (owner !== SPLIT) {
      parts[owner].amount += item.amount;
      parts[owner].items.push(item);
      continue;
    }
    const amounts = splitByWeights(item.amount, participants, weights, paidBy);
    for (const p of participants) {
      if (!weights[p]) continue;
      parts[p].amount += amounts[p];
      parts[p].items.push({
        ...item,
        amount: amounts[p],
        ...(item.quantity !== undefined && { quantity: Math.round(((item.quantity * weights[p]) / 100) * 1000) / 1000 }),
      });
    }
  }

  // What the lines do not account for (no lines at all, or a receipt total that differs from them)
  const rest = whole.total - lineSum;
  if (whole.shared) {
    const amounts = splitByWeights(rest, participants, weights, paidBy);
    for (const p of participants) parts[p].amount += amounts[p];
  } else {
    parts[home].amount += rest;
  }

  if (!whole.shared) return { shared: false, holders: [home], parts };
  const holders = participants.filter((p) => parts[p].amount !== 0 || p === paidBy);
  return holders.length > 1 ? { shared: true, holders, parts } : { shared: false, holders: holders.length ? holders : [home], parts };
}

/** Split settings from a form: who paid and the percentages. Bad input falls back to the payer given and equal parts. */
export function parseSplit(form: { paidBy?: unknown; weights?: unknown }, participants: string[], defaultPayer: string): { paidBy: string; weights: Weights } {
  let raw: Record<string, unknown> | null = null;
  if (typeof form.weights === "string" && form.weights) {
    try {
      const parsed: unknown = JSON.parse(form.weights);
      if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
    } catch {
      raw = null;
    }
  }
  const paidBy = typeof form.paidBy === "string" && participants.includes(form.paidBy) ? form.paidBy : defaultPayer;
  return { paidBy, weights: normalizeWeights(participants, raw) };
}
