import "server-only";
import { PERSON_COLORS } from "./access";
import { DEFAULT_CATEGORIES } from "./default-categories";
import { COLLECTIONS, db, userCollection, userDoc } from "./firestore";
import type { Role, User } from "./types";

type UserRecord = Omit<User, "id">;

function toUser(id: string, data: UserRecord): User {
  return {
    id,
    email: data.email,
    name: data.name,
    role: data.role,
    disabled: data.disabled,
    sessionVersion: data.sessionVersion,
    createdAt: data.createdAt,
    color: data.color ?? PERSON_COLORS[0],
    ...(data.picture && { picture: data.picture }),
    ...(data.avatar && { avatar: data.avatar }),
    ...(data.lastLoginAt && { lastLoginAt: data.lastLoginAt }),
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUser(uid: string): Promise<User | null> {
  const doc = await userDoc(uid).get();
  return doc.exists ? toUser(doc.id, doc.data() as UserRecord) : null;
}

export async function findByEmail(email: string): Promise<User | null> {
  const snapshot = await db().collection(COLLECTIONS.users).where("email", "==", normalizeEmail(email)).limit(1).get();
  const doc = snapshot.docs[0];
  return doc ? toUser(doc.id, doc.data() as UserRecord) : null;
}

export async function listUsers(): Promise<User[]> {
  const snapshot = await db().collection(COLLECTIONS.users).orderBy("createdAt").get();
  return snapshot.docs.map((doc) => toUser(doc.id, doc.data() as UserRecord));
}

/** Creates the account and seeds default categories in one batch. */
export async function createUser(input: { email: string; name: string; role: Role; picture?: string; avatar?: string }): Promise<User> {
  const email = normalizeEmail(input.email);
  const existing = await listUsers();
  if (existing.some((u) => u.email === email)) throw new Error(`Account ${email} already exists`);

  const ref = db().collection(COLLECTIONS.users).doc();
  const record: UserRecord = {
    email,
    name: input.name,
    role: input.role,
    disabled: false,
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
    // Next free colour, so two people never share one in the shared view
    color: PERSON_COLORS.find((c) => !existing.some((u) => u.color === c)) ?? PERSON_COLORS[existing.length % PERSON_COLORS.length],
    ...(input.picture && { picture: input.picture }),
    ...(input.avatar && { avatar: input.avatar }),
  };

  const batch = db().batch();
  batch.set(ref, record);
  for (const category of DEFAULT_CATEGORIES) {
    batch.set(userCollection(ref.id, "categories").doc(), category);
  }
  await batch.commit();
  return toUser(ref.id, record);
}

/** Signs the user out of every device - every older session cookie stops matching. */
export async function revokeSessions(uid: string): Promise<User | null> {
  await db().runTransaction(async (tx) => {
    const ref = userDoc(uid);
    const doc = await tx.get(ref);
    tx.update(ref, { sessionVersion: ((doc.data()?.sessionVersion as number) ?? 0) + 1 });
  });
  return getUser(uid);
}

export async function updateUser(uid: string, fields: Partial<Pick<User, "name" | "role" | "disabled" | "picture" | "lastLoginAt" | "avatar">>) {
  await userDoc(uid).update(fields);
}

/** Everyone who can share expenses: active accounts, in sign-up order. */
export async function activeUsers(): Promise<User[]> {
  return (await listUsers()).filter((u) => !u.disabled);
}
