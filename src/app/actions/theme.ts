"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/session";
import { THEME_COOKIE, toTheme } from "@/lib/theme";

/** Remembered in a cookie, so the page is rendered in the right colours from the first byte. */
export async function setTheme(formData: FormData) {
  await requireUser();
  (await cookies()).set(THEME_COOKIE, toTheme(formData.get("theme")), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  revalidatePath("/", "layout");
}
