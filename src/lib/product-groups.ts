/**
 * Product groups and units for per-product statistics ("how many kilograms
 * of fruit this month"). Fixed lists, so the model can only pick from them
 * and statistics never fragment into near-duplicate groups.
 */
export const PRODUCT_GROUPS = {
  fruit: { name: "Owoce", emoji: "🍎" },
  vegetables: { name: "Warzywa", emoji: "🥕" },
  meat: { name: "Mięso i wędliny", emoji: "🍗" },
  fish: { name: "Ryby i owoce morza", emoji: "🐟" },
  dairy: { name: "Nabiał i jajka", emoji: "🧀" },
  bread: { name: "Pieczywo", emoji: "🥖" },
  grains: { name: "Makarony, kasze, mąka", emoji: "🌾" },
  frozen: { name: "Mrożonki", emoji: "🧊" },
  ready: { name: "Dania gotowe", emoji: "🍱" },
  sweets: { name: "Słodycze i przekąski", emoji: "🍫" },
  drinks: { name: "Napoje", emoji: "🥤" },
  alcohol: { name: "Alkohol", emoji: "🍷" },
  pantry: { name: "Przyprawy, sosy, oleje", emoji: "🧂" },
  household: { name: "Chemia i kosmetyki", emoji: "🧴" },
  other: { name: "Inne", emoji: "📦" },
} as const;

export type ProductGroup = keyof typeof PRODUCT_GROUPS;
export const PRODUCT_GROUP_IDS = Object.keys(PRODUCT_GROUPS) as ProductGroup[];

export function isProductGroup(value: unknown): value is ProductGroup {
  return typeof value === "string" && value in PRODUCT_GROUPS;
}

/** Weight in kilograms, volume in litres, everything else counted in pieces. */
export const UNITS = ["kg", "l", "szt"] as const;
export type Unit = (typeof UNITS)[number];

export function isUnit(value: unknown): value is Unit {
  return typeof value === "string" && (UNITS as readonly string[]).includes(value);
}

const quantityFormat = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 });

/** 1.5, "kg" -> "1,5 kg"; 3, "szt" -> "3 szt." */
export function formatQuantity(quantity: number, unit: Unit): string {
  return `${quantityFormat.format(quantity)} ${unit === "szt" ? "szt." : unit}`;
}
