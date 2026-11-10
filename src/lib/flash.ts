import "server-only";
import { cookies } from "next/headers";

export const FLASH_COOKIE = "et_flash";

export interface Flash {
  id: string;
  text: string;
  /** "party" adds confetti - for money paid back. */
  kind: "ok" | "party";
}

/** A one-time message for the next screen, shown as a toast: "Zapisano", "Oddane"... */
export async function flash(text: string, kind: Flash["kind"] = "ok") {
  (await cookies()).set(FLASH_COOKIE, JSON.stringify({ id: Date.now().toString(36), text, kind } satisfies Flash), {
    path: "/",
    maxAge: 30,
    sameSite: "lax",
  });
}

export async function readFlash(): Promise<Flash | null> {
  try {
    const value = (await cookies()).get(FLASH_COOKIE)?.value;
    const parsed = value ? (JSON.parse(value) as Flash) : null;
    return parsed && typeof parsed.text === "string" && typeof parsed.id === "string" ? parsed : null;
  } catch {
    return null;
  }
}
