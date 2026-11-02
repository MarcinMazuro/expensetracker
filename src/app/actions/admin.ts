"use server";

import { revalidatePath } from "next/cache";
import { passwordProblem } from "@/lib/password";
import { requireAdmin } from "@/lib/session";
import { createUser, getUser, setPassword, updateUser } from "@/lib/users";
import { isEmail, optionalText } from "@/lib/validation";
import type { FormState } from "./auth";

export async function addUser(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const name = optionalText(formData.get("name"), 60);
  const password = formData.get("password");
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (!isEmail(email)) return { error: "Podaj poprawny e-mail." };
  if (!name) return { error: "Podaj imię." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };

  try {
    await createUser({ email, name, password: password as string, role });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Nie udało się utworzyć konta." };
  }
  revalidatePath("/admin");
  return { success: `Utworzono konto ${email}. Przekaż hasło tej osobie - po zalogowaniu może je zmienić w Ustawieniach.` };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const uid = String(formData.get("id") ?? "");
  const password = formData.get("password");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (!(await getUser(uid))) return { error: "Nie ma takiego konta." };

  await setPassword(uid, password as string);
  return { success: "Ustawiono nowe hasło. Ta osoba została wylogowana ze wszystkich urządzeń." };
}

export async function toggleUser(formData: FormData) {
  const admin = await requireAdmin();
  const uid = String(formData.get("id") ?? "");
  // Locking yourself out would leave nobody able to manage accounts
  if (uid === admin.id) return;
  const user = await getUser(uid);
  if (user) await updateUser(uid, { disabled: !user.disabled });
  revalidatePath("/admin");
}
