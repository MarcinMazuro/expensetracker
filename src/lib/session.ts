import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUser } from "./users";
import { createToken, readToken } from "./token";
import type { User } from "./types";

const COOKIE = "et_session";
const MAX_AGE_DAYS = 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET is missing or shorter than 32 characters");
  return value;
}

export async function startSession(user: User) {
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  const token = createToken({ uid: user.id, v: user.sessionVersion, exp: Date.now() + maxAge * 1000 }, secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/**
 * The signed-in user, or null. The user document is read on every request,
 * so disabling an account or changing a password takes effect immediately.
 * Wrapped in cache() - one Firestore read per request however many
 * components ask.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  const payload = readToken((await cookies()).get(COOKIE)?.value, secret());
  if (!payload) return null;

  const user = await getUser(payload.uid);
  if (!user || user.disabled || user.sessionVersion !== payload.v) return null;
  return user;
});

/** For pages and server actions: the user, or a redirect to the login page. */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
