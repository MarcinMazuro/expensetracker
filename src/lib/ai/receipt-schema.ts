/**
 * Receipt extraction contract: the JSON schema the model must follow and the
 * validation of what it actually returned. Pure - no SDK imports - so it is
 * unit tested without calling the model.
 */
import { isIsoDate } from "../dates";
import { isCurrency, type Currency } from "../money";
import { isProductGroup, isUnit, PRODUCT_GROUP_IDS, PRODUCT_GROUPS, UNITS, type ProductGroup, type Unit } from "../product-groups";
import type { Category } from "../types";

export function receiptJsonSchema(categoryIds: string[]) {
  return {
    type: "object",
    properties: {
      isReceipt: { type: "boolean", description: "false when the photo is not a receipt or invoice" },
      merchant: { type: "string", description: "Shop or company name, short, e.g. 'Biedronka', 'Orlen'" },
      date: { type: "string", description: "Purchase date YYYY-MM-DD, empty string if unreadable" },
      currency: { type: "string", description: "ISO 4217 code, PLN for Polish receipts" },
      total: { type: "number", description: "Amount actually paid (SUMA / DO ZAPŁATY)" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Product name, expanded from receipt abbreviations if obvious" },
            amount: { type: "number", description: "Final line price after discounts" },
            categoryId: { type: "string", enum: categoryIds },
            product: { type: "string", description: "Generic Polish base name of the product, lowercase, without brand, size or variety, e.g. 'marchew', 'pierś z kurczaka', 'mleko', 'jabłka'" },
            quantity: { type: "number", description: "Amount bought, in the unit below" },
            unit: { type: "string", enum: [...UNITS] },
            group: { type: "string", enum: PRODUCT_GROUP_IDS },
          },
          required: ["name", "amount", "categoryId", "product", "quantity", "unit", "group"],
        },
      },
    },
    required: ["isReceipt", "merchant", "date", "currency", "total", "items"],
  };
}

export function receiptPrompt(categories: Category[], today: string, knownProducts: string[] = []): string {
  const list = categories.map((c) => `- ${c.id}: ${c.emoji} ${c.name}`).join("\n");
  const groups = PRODUCT_GROUP_IDS.map((id) => `${id} (${PRODUCT_GROUPS[id].name})`).join(", ");
  const known = knownProducts.length
    ? `\n- Product names this user already has - reuse one exactly when it is the same product: ${knownProducts.map((p) => JSON.stringify(p)).join(", ")}.`
    : "";
  return `You read photos of shopping receipts (mostly Polish "paragon fiskalny") for a personal expense tracker.

Extract the merchant, purchase date, currency, the total actually paid and every purchased line.
Rules:
- Line amount is the final price of that line (quantity x unit price) with any discount lines ("RABAT", "OPUST", "PROMOCJA") subtracted from the product they apply to. Never list discounts, deposits returns or VAT summaries as separate products.
- Bottle deposits ("KAUCJA") are a separate line.
- The sum of line amounts should equal the total. If the receipt is partly unreadable, still return the lines you can read.
- Expand cryptic abbreviations only when you are confident ("MLEKO LAC 2% 1L" -> "Mleko łaciate 2% 1 l"). Keep product names in Polish.
- Assign every line the best matching category id from this list:
${list}
- For per-product statistics give every line:
  - product: a generic base name in Polish, lowercase, so the same product bought in different shops gets the same name ("MARCHEW LUZ", "Marchewka myta 1kg" -> "marchew"; "FILET Z PIERSI KURCZ" -> "pierś z kurczaka"; "JABLKA LIGOL" -> "jabłka"; "MLEKO LAC 2% 1L" -> "mleko"). Not the brand, size or variety.${known}
  - quantity and unit: weighed goods in kg from the weight on the receipt ("0,834 x 4,99" -> 0.834 kg). Packaged food with a weight or volume in its name in kg or l, multiplied by the count ("2 x MLEKO 1L" -> 2 l, "SER GOUDA 150G" -> 0.15 kg). Anything else in pieces (szt) - the count bought. Deposits: szt.
  - group: one of ${groups}.
- Today is ${today}; a receipt date in the future is a misread - return an empty date instead.
- If the image is not a receipt or invoice, set isReceipt to false and return empty values.`;
}

export interface ReceiptDraftItem {
  name: string;
  amount: number;
  categoryId: string;
  product: string;
  quantity: number;
  unit: Unit;
  group: ProductGroup;
}

/** Lowercase, trimmed, single spaces - "  Pierś z KURCZAKA " -> "pierś z kurczaka". */
export function normalizeProductName(value: unknown, fallback: string): string {
  const text = typeof value === "string" ? value : "";
  const cleaned = text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
  return cleaned || fallback.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
}

/** Validates the product fields of one line (model output or user edits). */
export function normalizeProductFields(item: Record<string, unknown>, name: string): Pick<ReceiptDraftItem, "product" | "quantity" | "unit" | "group"> {
  const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity < 10_000
    ? Math.round(item.quantity * 1000) / 1000
    : 1;
  return {
    product: normalizeProductName(item.product, name),
    quantity,
    unit: isUnit(item.unit) ? item.unit : "szt",
    group: isProductGroup(item.group) ? item.group : "other",
  };
}

export interface ReceiptDraft {
  merchant: string;
  date: string;
  currency: Currency;
  total: number;
  items: ReceiptDraftItem[];
  /** Line sum differs from the printed total - the UI asks to double-check. */
  mismatch: boolean;
}

const toMinor = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value * 100) : null;

/**
 * Turns the model's JSON into a draft the user reviews. Never trusts the
 * model: unknown categories fall back, impossible dates are dropped,
 * amounts are re-checked against the total.
 */
export function normalizeReceipt(
  raw: unknown,
  categoryIds: Set<string>,
  fallbackCategoryId: string,
  today: string,
): ReceiptDraft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;
  if (data.isReceipt === false) return null;

  const items: ReceiptDraftItem[] = (Array.isArray(data.items) ? data.items : [])
    .filter((item: unknown): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 120) : "";
      return {
        name,
        amount: toMinor(item.amount) ?? 0,
        categoryId: typeof item.categoryId === "string" && categoryIds.has(item.categoryId) ? item.categoryId : fallbackCategoryId,
        ...normalizeProductFields(item, name),
      };
    })
    .filter((item) => item.name && item.amount !== 0)
    .slice(0, 200);

  const itemsSum = items.reduce((sum, item) => sum + item.amount, 0);
  const printedTotal = toMinor(data.total);
  const total = printedTotal && printedTotal > 0 ? printedTotal : itemsSum;
  if (total <= 0) return null;

  const date = isIsoDate(data.date) && data.date <= today ? data.date : today;
  const currency = typeof data.currency === "string" && isCurrency(data.currency.toUpperCase())
    ? (data.currency.toUpperCase() as Currency)
    : "PLN";

  return {
    merchant: typeof data.merchant === "string" && data.merchant.trim() ? data.merchant.trim().slice(0, 120) : "Paragon",
    date,
    currency,
    total,
    items,
    // Rounding on receipts is at most a few grosze
    mismatch: items.length > 0 && Math.abs(itemsSum - total) > Math.max(5, total * 0.01),
  };
}

/**
 * Groups receipt lines by category - one receipt from a supermarket becomes
 * "groceries 84,20" + "household 23,99" instead of one blurred expense. The
 * printed total wins over the line sum: the difference (rounding, an
 * unreadable line) goes to the largest group.
 */
export function splitByCategory<T extends { amount: number; categoryId: string }>(
  draft: { items: T[]; total: number },
): { categoryId: string; amount: number; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of draft.items) {
    groups.set(item.categoryId, [...(groups.get(item.categoryId) ?? []), item]);
  }
  const result = [...groups.entries()]
    .map(([categoryId, items]) => ({ categoryId, items, amount: items.reduce((s, i) => s + i.amount, 0) }))
    .sort((a, b) => b.amount - a.amount);

  const difference = draft.total - result.reduce((s, g) => s + g.amount, 0);
  if (result.length > 0) result[0].amount += difference;
  return result.filter((g) => g.amount > 0);
}
