import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed session token: base64url(JSON payload).base64url(HMAC-SHA256).
 * Pure functions with no Next.js imports, so they can be unit tested.
 */
export interface SessionPayload {
  uid: string;
  /** Must match user.sessionVersion, otherwise the session was revoked. */
  v: number;
  /** Expiry, epoch milliseconds. */
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function createToken(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function readToken(token: string | undefined, secret: string, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.v !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}
