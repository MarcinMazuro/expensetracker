import { createHash, randomBytes } from "node:crypto";

/**
 * "Sign in with Google" - OpenID Connect authorization code flow with PKCE.
 * The browser never sees a token: Google redirects back with a one-time
 * code, the server exchanges it (with the client secret and the PKCE
 * verifier) and verifies the signed ID token. Pure helpers live here; the
 * network calls are in the route handlers.
 */
export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const CALLBACK_PATH = "/api/auth/google/callback";

export interface OAuthState {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
  exp: number;
}

const random = () => randomBytes(32).toString("base64url");

export function newOAuthState(next: string, now = Date.now()): OAuthState {
  return { state: random(), verifier: random(), nonce: random(), next: safeNext(next), exp: now + 10 * 60 * 1000 };
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function authorizationUrl(clientId: string, redirectUri: string, s: OAuthState): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: s.state,
    nonce: s.nonce,
    code_challenge: pkceChallenge(s.verifier),
    code_challenge_method: "S256",
    // Always show the account picker - two people may share a laptop
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

/** Only local paths - an absolute URL here would be an open redirect. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export interface IdentityClaims {
  email?: string;
  email_verified?: boolean;
  nonce?: string;
  name?: string;
  given_name?: string;
  picture?: string;
}

export type IdentityCheck = { ok: true; email: string } | { ok: false; reason: "nonce" | "unverified" | "denied" };

/** Checks done after the ID token signature, audience, issuer and expiry are verified. */
export function checkIdentity(claims: IdentityClaims, expectedNonce: string, allowed: Set<string>): IdentityCheck {
  if (!claims.nonce || claims.nonce !== expectedNonce) return { ok: false, reason: "nonce" };
  const email = claims.email?.trim().toLowerCase();
  if (!email || claims.email_verified !== true) return { ok: false, reason: "unverified" };
  if (!allowed.has(email)) return { ok: false, reason: "denied" };
  return { ok: true, email };
}
