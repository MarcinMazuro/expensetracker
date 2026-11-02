import type { Category } from "./types";

/** Seeded for every new account; users can rename, recolour and delete them. */
export const DEFAULT_CATEGORIES: Omit<Category, "id">[] = [
  { name: "Spożywcze", emoji: "🛒", color: "#22c55e", budget: 0, order: 0 },
  { name: "Restauracje i kawiarnie", emoji: "🍽️", color: "#f97316", budget: 0, order: 1 },
  { name: "Transport", emoji: "🚗", color: "#3b82f6", budget: 0, order: 2 },
  { name: "Mieszkanie i rachunki", emoji: "🏠", color: "#8b5cf6", budget: 0, order: 3 },
  { name: "Zdrowie i uroda", emoji: "💊", color: "#ec4899", budget: 0, order: 4 },
  { name: "Chemia i dom", emoji: "🧴", color: "#14b8a6", budget: 0, order: 5 },
  { name: "Ubrania", emoji: "👕", color: "#eab308", budget: 0, order: 6 },
  { name: "Rozrywka i hobby", emoji: "🎮", color: "#ef4444", budget: 0, order: 7 },
  { name: "Subskrypcje", emoji: "📺", color: "#6366f1", budget: 0, order: 8 },
  { name: "Elektronika", emoji: "💻", color: "#0ea5e9", budget: 0, order: 9 },
  { name: "Prezenty", emoji: "🎁", color: "#d946ef", budget: 0, order: 10 },
  { name: "Podróże", emoji: "✈️", color: "#06b6d4", budget: 0, order: 11 },
  { name: "Edukacja", emoji: "📚", color: "#84cc16", budget: 0, order: 12 },
  { name: "Inne", emoji: "📦", color: "#78716c", budget: 0, order: 13 },
];
