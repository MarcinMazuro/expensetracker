"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAvatarId } from "@/lib/access";
import { endSession, requireUser, startSession } from "@/lib/session";
import { revokeSessions, updateUser } from "@/lib/users";

export type FormState = { error?: string; success?: string } | undefined;

export async function logout() {
  await endSession();
  redirect("/login");
}

/** Signs out every other device (lost phone) and keeps this one signed in. */
export async function logoutEverywhere(): Promise<FormState> {
  const user = await requireUser();
  const updated = await revokeSessions(user.id);
  if (updated) await startSession(updated);
  return { success: "Wylogowano ze wszystkich innych urządzeń." };
}

/** "lion", "puma", or "" for the Google photo / initials. */
export async function setAvatar(formData: FormData) {
  const user = await requireUser();
  const value = String(formData.get("avatar") ?? "");
  // An empty value falls back to the Google photo or initials
  await updateUser(user.id, { avatar: isAvatarId(value) ? value : "" });
  revalidatePath("/", "layout");
}
