import { OAuth2Client } from "google-auth-library";
import { NextResponse } from "next/server";
import { allowedEmails, defaultAvatar, isAdminEmail } from "@/lib/access";
import { CALLBACK_PATH, checkIdentity, GOOGLE_TOKEN_URL, type IdentityClaims } from "@/lib/google-oauth";
import { clientAddress, isRateLimited } from "@/lib/protection";
import { appUrl, OAUTH_COOKIE, readOAuthCookie, startSession } from "@/lib/session";
import { createUser, findByEmail, updateUser } from "@/lib/users";

export const runtime = "nodejs";

const verifier = new OAuth2Client();

/**
 * Step 2: Google sends the user back with a one-time code. The code is
 * exchanged server-side (client secret + PKCE verifier), the ID token's
 * signature, audience, issuer and expiry are verified against Google's keys,
 * then nonce, verified e-mail and the allowlist are checked.
 */
export async function GET(request: Request) {
  const fail = (reason: string) => {
    const response = NextResponse.redirect(new URL(`/login?error=${reason}`, appUrl()));
    response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
    return response;
  };

  if (isRateLimited(`oauth:${clientAddress(request.headers)}`, { max: 20, seconds: 900 })) return fail("limit");

  const params = new URL(request.url).searchParams;
  const oauth = readOAuthCookie(request.headers.get("cookie"));
  if (params.get("error")) return fail("cancelled");
  const code = params.get("code");
  if (!oauth || !code || params.get("state") !== oauth.state) return fail("expired");

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  let claims: IdentityClaims;
  try {
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: appUrl() + CALLBACK_PATH,
        grant_type: "authorization_code",
        code_verifier: oauth.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new Error(`token endpoint returned ${tokenResponse.status}`);
    const { id_token } = (await tokenResponse.json()) as { id_token?: string };
    if (!id_token) throw new Error("no id_token in the token response");

    const ticket = await verifier.verifyIdToken({ idToken: id_token, audience: clientId });
    claims = ticket.getPayload() ?? {};
  } catch (error) {
    console.error("Google sign-in failed:", error);
    return fail("failed");
  }

  const identity = checkIdentity(claims, oauth.nonce, allowedEmails());
  if (!identity.ok) {
    console.warn(`Google sign-in rejected (${identity.reason}) for ${claims.email ?? "unknown"}`);
    return fail(identity.reason === "denied" ? "denied" : "failed");
  }

  let user = await findByEmail(identity.email);
  if (!user) {
    // First sign-in of an allowed address creates the account
    user = await createUser({
      email: identity.email,
      name: claims.given_name || claims.name || identity.email.split("@")[0],
      role: isAdminEmail(identity.email) ? "admin" : "member",
      picture: claims.picture,
      avatar: defaultAvatar(identity.email),
    });
  }
  if (user.disabled) return fail("denied");
  await updateUser(user.id, { lastLoginAt: new Date().toISOString(), ...(claims.picture && { picture: claims.picture }) });

  await startSession(user);
  const response = NextResponse.redirect(new URL(oauth.next, appUrl()));
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  return response;
}
