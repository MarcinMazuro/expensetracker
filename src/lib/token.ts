import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed tokens: base64url(JSON payload).base64url(HMAC-SHA256). Used for the
 * session cookie and for the short-lived OAuth state cookie. Pure functions
 * with no Next.js imports, so they can be unit tested.
 */
function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createSigned<T extends { exp: number }>(payload: T, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

/** The payload, or null when the token is missing, forged or expired. */
export function readSigned<T extends { exp: number }>(token: string | undefined, secret: string, now = Date.now()): T | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as T;
    return typeof payload.exp === "number" && payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

export interface SessionPayload {
  uid: string;
  /** Must match user.sessionVersion, otherwise the session was revoked. */
  v: number;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

export function createToken(payload: SessionPayload, secret: string): string {
  return createSigned(payload, secret);
}

export function readToken(token: string | undefined, secret: string, now = Date.now()): SessionPayload | null {
  const payload = readSigned<SessionPayload>(token, secret, now);
  return payload && typeof payload.uid === "string" && typeof payload.v === "number" ? payload : null;
}
