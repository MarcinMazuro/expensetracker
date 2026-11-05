import { NextResponse } from "next/server";
import { devLoginEnabled } from "@/lib/access";
import { appUrl, startSession } from "@/lib/session";
import { getUser } from "@/lib/users";

export const runtime = "nodejs";

/** Local preview only: sign in as a seeded demo user without Google. See devLoginEnabled(). */
export async function POST(request: Request) {
  if (!devLoginEnabled()) return new Response("Not found", { status: 404 });

  const uid = String((await request.formData()).get("uid") ?? "");
  const user = await getUser(uid);
  if (!user || user.disabled) return NextResponse.redirect(new URL("/login?error=denied", appUrl()), 303);

  await startSession(user);
  return NextResponse.redirect(new URL("/", appUrl()), 303);
}
