/**
 * Per-product statistics built from receipt lines stored on expenses:
 * "how much carrot", "how many kilograms of fruit", "where is chicken
 * breast cheapest". Pure functions over a list of expenses.
 */
import { normalizeProductName } from "./ai/receipt-schema";
import { convert } from "./money";
import type { ProductGroup, Unit } from "./product-groups";
import { merchantKey } from "./text";
import type { Expense } from "./types";

export interface ProductLine {
  key: string;
  product: string;
  group: ProductGroup;
  quantity: number;
  unit: Unit;
  /** Line price in PLN, minor units. */
  amountPln: number;
  date: string;
  merchant: string;
  expenseId: string;
}

/** URL-safe key: "pierś z kurczaka" -> "piers-z-kurczaka". */
export function productKey(product: string): string {
  return merchantKey(product).replace(/ /g, "-");
}

/** Every receipt line of the given expenses, in PLN. */
export function productLines(expenses: Expense[]): ProductLine[] {
  const lines: ProductLine[] = [];
  for (const expense of expenses) {
    for (const item of expense.items ?? []) {
      // Receipts saved before product fields existed: the line name stands in
      const product = normalizeProductName(item.product, item.name);
      const key = productKey(product);
      if (!key) continue;
      lines.push({
        key,
        product,
        group: item.group ?? "other",
        quantity: item.quantity ?? 1,
        unit: item.unit ?? "szt",
        amountPln: convert(item.amount, expense.fxRate),
        date: expense.date,
        merchant: expense.merchant,
        expenseId: expense.id,
      });
    }
  }
  return lines;
}

export type Quantities = Partial<Record<Unit, number>>;

function addQuantity(quantities: Quantities, unit: Unit, quantity: number) {
  quantities[unit] = Math.round(((quantities[unit] ?? 0) + quantity) * 1000) / 1000;
}

export interface ProductSummary {
  key: string;
  product: string;
  group: ProductGroup;
  spend: number;
  purchases: number;
  quantities: Quantities;
  /** The unit most of the money went on - the one prices are compared in. */
  mainUnit: Unit;
  /** PLN minor units per one main unit (per kg, per litre, per piece). */
  unitPrice: number | null;
}

function summarize(key: string, lines: ProductLine[]): ProductSummary {
  const quantities: Quantities = {};
  const spendByUnit: Partial<Record<Unit, number>> = {};
  const groupSpend = new Map<ProductGroup, number>();
  let spend = 0;
  for (const line of lines) {
    spend += line.amountPln;
    addQuantity(quantities, line.unit, line.quantity);
    spendByUnit[line.unit] = (spendByUnit[line.unit] ?? 0) + line.amountPln;
    groupSpend.set(line.group, (groupSpend.get(line.group) ?? 0) + line.amountPln);
  }
  const mainUnit = (Object.entries(spendByUnit) as [Unit, number][]).sort((a, b) => b[1] - a[1])[0][0];
  const mainQuantity = quantities[mainUnit] ?? 0;
  // The most recent name wins - if the user renamed a product, show the new name
  const latest = lines.reduce((a, b) => (b.date >= a.date ? b : a));
  return {
    key,
    product: latest.product,
    group: [...groupSpend.entries()].sort((a, b) => b[1] - a[1])[0][0],
    spend,
    purchases: new Set(lines.map((l) => l.expenseId)).size,
    quantities,
    mainUnit,
    unitPrice: mainQuantity > 0 ? Math.round((spendByUnit[mainUnit] ?? 0) / mainQuantity) : null,
  };
}

/** One row per product, largest spend first. */
export function aggregateProducts(lines: ProductLine[]): ProductSummary[] {
  const byKey = new Map<string, ProductLine[]>();
  for (const line of lines) byKey.set(line.key, [...(byKey.get(line.key) ?? []), line]);
  return [...byKey.entries()].map(([key, list]) => summarize(key, list)).sort((a, b) => b.spend - a.spend);
}

export interface GroupSummary {
  group: ProductGroup;
  spend: number;
  quantities: Quantities;
  products: number;
}

/** Fruit: 3.2 kg, 45 zł, 6 products. */
export function aggregateGroups(lines: ProductLine[]): GroupSummary[] {
  const map = new Map<ProductGroup, { spend: number; quantities: Quantities; products: Set<string> }>();
  for (const line of lines) {
    const entry = map.get(line.group) ?? { spend: 0, quantities: {}, products: new Set<string>() };
    entry.spend += line.amountPln;
    addQuantity(entry.quantities, line.unit, line.quantity);
    entry.products.add(line.key);
    map.set(line.group, entry);
  }
  return [...map.entries()]
    .map(([group, e]) => ({ group, spend: e.spend, quantities: e.quantities, products: e.products.size }))
    .sort((a, b) => b.spend - a.spend);
}

/** Quantity, spend and unit price of one product in each month. */
export function productHistory(lines: ProductLine[], months: string[], unit: Unit) {
  return months.map((month) => {
    const inMonth = lines.filter((l) => l.date.startsWith(month));
    const sameUnit = inMonth.filter((l) => l.unit === unit);
    const quantity = Math.round(sameUnit.reduce((s, l) => s + l.quantity, 0) * 1000) / 1000;
    const unitSpend = sameUnit.reduce((s, l) => s + l.amountPln, 0);
    return {
      month,
      quantity,
      spend: inMonth.reduce((s, l) => s + l.amountPln, 0),
      unitPrice: quantity > 0 ? Math.round(unitSpend / quantity) : null,
    };
  });
}

/** Average price per unit in each shop, cheapest first. */
export function priceByMerchant(lines: ProductLine[], unit: Unit) {
  const map = new Map<string, { merchant: string; spend: number; quantity: number; purchases: number }>();
  for (const line of lines.filter((l) => l.unit === unit)) {
    const key = line.merchant.toLowerCase();
    const entry = map.get(key) ?? { merchant: line.merchant, spend: 0, quantity: 0, purchases: 0 };
    entry.spend += line.amountPln;
    entry.quantity += line.quantity;
    entry.purchases++;
    map.set(key, entry);
  }
  return [...map.values()]
    .filter((e) => e.quantity > 0)
    .map((e) => ({ ...e, unitPrice: Math.round(e.spend / e.quantity) }))
    .sort((a, b) => a.unitPrice - b.unitPrice);
}
