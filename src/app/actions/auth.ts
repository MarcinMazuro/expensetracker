"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DUMMY_HASH, passwordProblem, verifyPassword } from "@/lib/password";
import { clientAddress, isRateLimited } from "@/lib/protection";
import { endSession, requireUser, startSession } from "@/lib/session";
import { findForLogin, getUser, normalizeEmail, setPassword } from "@/lib/users";

export type FormState = { error?: string; success?: string } | undefined;

/** The e-mail goes back to the form - React resets it after the action, and retyping it after a typo in the password is annoying. */
export type LoginState = { error: string; email: string } | undefined;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");

  // Two limits: per address (one attacker, many accounts) and per account
  // (many addresses, one account)
  const ip = clientAddress(await headers());
  if (
    isRateLimited(`login:ip:${ip}`, { max: 10, seconds: 900 }) ||
    isRateLimited(`login:email:${email}`, { max: 10, seconds: 900 })
  ) {
    return { error: "Za dużo prób logowania. Spróbuj ponownie za 15 minut.", email };
  }

  const user = email ? await findForLogin(email) : null;
  // The hash is checked even for an unknown e-mail, so timing does not reveal which accounts exist
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !valid || user.disabled) {
    return { error: "Nieprawidłowy e-mail lub hasło.", email };
  }

  await startSession(user);
  const next = String(formData.get("next") ?? "/");
  // Only local paths - an absolute URL here would be an open redirect
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("password") ?? "");

  if (isRateLimited(`password:${user.id}`, { max: 5, seconds: 900 })) {
    return { error: "Za dużo prób. Spróbuj ponownie za kilka minut." };
  }

  const record = await findForLogin(user.email);
  if (!record || !(await verifyPassword(current, record.passwordHash))) {
    return { error: "Obecne hasło jest nieprawidłowe." };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== formData.get("confirm")) return { error: "Hasła się różnią." };

  await setPassword(user.id, next);
  // Other devices are signed out by the version bump; this one gets a fresh cookie
  const updated = await getUser(user.id);
  if (updated) await startSession(updated);
  return { success: "Hasło zmienione. Pozostałe urządzenia zostały wylogowane." };
}
