import { NextResponse } from "next/server";
import { authorizationUrl, CALLBACK_PATH, newOAuthState } from "@/lib/google-oauth";
import { appUrl, OAUTH_COOKIE, oauthCookieValue } from "@/lib/session";

export const runtime = "nodejs";

/** Step 1: remember state, nonce and PKCE verifier in a signed cookie, then go to Google. */
export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(new URL("/login?error=config", appUrl()));
  }

  const oauth = newOAuthState(new URL(request.url).searchParams.get("next") ?? "/");
  const response = NextResponse.redirect(authorizationUrl(clientId, appUrl() + CALLBACK_PATH, oauth));
  response.cookies.set(OAUTH_COOKIE, oauthCookieValue(oauth), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax: the cookie must come back on Google's top-level redirect to the callback
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 600,
  });
  return response;
}
