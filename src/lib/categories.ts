import "server-only";
import { userCollection } from "./firestore";
import type { Category } from "./types";

export const CATEGORY_COLORS = [
  "#22c55e", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308",
  "#ef4444", "#fb7185", "#6366f1", "#0ea5e9", "#d946ef", "#06b6d4", "#84cc16", "#78716c",
];

export async function listCategories(uid: string): Promise<Category[]> {
  const snapshot = await userCollection(uid, "categories").orderBy("order").get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Category);
}

/** Fallback when a category was deleted but old expenses still point at it. */
export const UNKNOWN_CATEGORY: Category = {
  id: "unknown",
  name: "Bez kategorii",
  emoji: "❔",
  color: "#a8a29e",
  budget: 0,
  order: 999,
};

export function categoryMap(categories: Category[]): Map<string, Category> {
  return new Map(categories.map((c) => [c.id, c]));
}
