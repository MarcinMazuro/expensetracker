"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { getUser, revokeSessions, updateUser } from "@/lib/users";

/** Blocks or unblocks an account; blocking also ends its sessions. */
export async function toggleUser(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("id") ?? "");
  // Locking yourself out would leave nobody able to manage accounts
  if (uid === admin.id) return;
  const user = await getUser(uid);
  if (!user) return;
  await updateUser(uid, { disabled: !user.disabled });
  if (!user.disabled) await revokeSessions(uid);
  revalidatePath("/admin");
}
