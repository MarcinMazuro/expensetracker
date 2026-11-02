import { Firestore } from "@google-cloud/firestore";

let instance: Firestore | null = null;

/**
 * Lazily created Firestore client.
 *
 * Must not be created at module level: the Cloud Build container has no
 * credentials and prerendering would fail. Local development uses the
 * separate "development" database (FIRESTORE_DATABASE in .env.local), production
 * the default one.
 */
export function db(): Firestore {
  if (!instance) {
    instance = new Firestore({
      projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "expensetracker-mm",
      databaseId: process.env.FIRESTORE_DATABASE || "(default)",
      ignoreUndefinedProperties: true,
    });
  }
  return instance;
}

/** All per-user data lives under users/{uid}, so ownership is part of the path. */
export const COLLECTIONS = {
  users: "users",
  expenses: "expenses",
  categories: "categories",
  recurring: "recurring",
  merchants: "merchants",
  products: "products",
  fxRates: "fx-rates",
} as const;

export function userDoc(uid: string) {
  return db().collection(COLLECTIONS.users).doc(uid);
}

export function userCollection(uid: string, name: "expenses" | "categories" | "recurring" | "merchants" | "products") {
  return userDoc(uid).collection(COLLECTIONS[name]);
}
