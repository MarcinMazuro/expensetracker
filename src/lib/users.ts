import "server-only";
import { DEFAULT_CATEGORIES } from "./default-categories";
import { COLLECTIONS, db, userCollection, userDoc } from "./firestore";
import { hashPassword } from "./password";
import type { Role, User } from "./types";

interface UserRecord extends Omit<User, "id"> {
  passwordHash: string;
}

function toUser(id: string, data: UserRecord): User {
  return {
    id,
    email: data.email,
    name: data.name,
    role: data.role,
    disabled: data.disabled,
    sessionVersion: data.sessionVersion,
    createdAt: data.createdAt,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUser(uid: string): Promise<User | null> {
  const doc = await userDoc(uid).get();
  return doc.exists ? toUser(doc.id, doc.data() as UserRecord) : null;
}

/** User plus password hash - only for the login check. */
export async function findForLogin(email: string): Promise<(User & { passwordHash: string }) | null> {
  const snapshot = await db().collection(COLLECTIONS.users).where("email", "==", normalizeEmail(email)).limit(1).get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  const data = doc.data() as UserRecord;
  return { ...toUser(doc.id, data), passwordHash: data.passwordHash };
}

export async function listUsers(): Promise<User[]> {
  const snapshot = await db().collection(COLLECTIONS.users).orderBy("createdAt").get();
  return snapshot.docs.map((doc) => toUser(doc.id, doc.data() as UserRecord));
}

/** Creates the account and seeds default categories in one batch. */
export async function createUser(input: { email: string; name: string; password: string; role: Role }): Promise<User> {
  const email = normalizeEmail(input.email);
  if (await findForLogin(email)) throw new Error("Konto z tym adresem już istnieje.");

  const ref = db().collection(COLLECTIONS.users).doc();
  const record: UserRecord = {
    email,
    name: input.name,
    role: input.role,
    disabled: false,
    sessionVersion: 1,
    createdAt: new Date().toISOString(),
    passwordHash: await hashPassword(input.password),
  };

  const batch = db().batch();
  batch.set(ref, record);
  for (const category of DEFAULT_CATEGORIES) {
    batch.set(userCollection(ref.id, "categories").doc(), category);
  }
  await batch.commit();
  return toUser(ref.id, record);
}

/** New password and a new session version - every other device is signed out. */
export async function setPassword(uid: string, password: string): Promise<number> {
  const passwordHash = await hashPassword(password);
  return db().runTransaction(async (tx) => {
    const ref = userDoc(uid);
    const doc = await tx.get(ref);
    const sessionVersion = ((doc.data()?.sessionVersion as number) ?? 0) + 1;
    tx.update(ref, { passwordHash, sessionVersion });
    return sessionVersion;
  });
}

export async function updateUser(uid: string, fields: Partial<Pick<User, "name" | "role" | "disabled">>) {
  await userDoc(uid).update(fields);
}
