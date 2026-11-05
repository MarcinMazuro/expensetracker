import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultAvatar, devLoginEnabled, parseEmailList } from "@/lib/access";
import { authorizationUrl, checkIdentity, newOAuthState, pkceChallenge, safeNext } from "@/lib/google-oauth";
import { clientAddress, isRateLimited, resetRateLimits } from "@/lib/protection";
import { createSigned, createToken, readSigned, readToken } from "@/lib/token";

const SECRET = "x".repeat(40);

describe("session token", () => {
  const payload = { uid: "u1", v: 2, exp: 2_000 };

  it("round-trips a valid token", () => {
    expect(readToken(createToken(payload, SECRET), SECRET, 1_000)).toEqual(payload);
  });

  it("rejects expired, tampered or foreign tokens", () => {
    const token = createToken(payload, SECRET);
    expect(readToken(token, SECRET, 3_000)).toBeNull();
    expect(readToken(token, "y".repeat(40), 1_000)).toBeNull();
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, uid: "admin" })).toString("base64url");
    expect(readToken(`${forged}.${signature}`, SECRET, 1_000)).toBeNull();
    expect(readToken(undefined, SECRET)).toBeNull();
  });

  it("does not accept an OAuth state cookie as a session", () => {
    const state = createSigned({ state: "s", exp: 2_000 }, SECRET);
    expect(readSigned(state, SECRET, 1_000)).toEqual({ state: "s", exp: 2_000 });
    expect(readToken(state, SECRET, 1_000)).toBeNull();
  });
});

describe("access list", () => {
  it("parses e-mails case-insensitively, ignoring junk", () => {
    expect([...parseEmailList(" Marcin@Gmail.com, agnieszka@gmail.com ,, nope")]).toEqual(["marcin@gmail.com", "agnieszka@gmail.com"]);
    expect(parseEmailList(undefined).size).toBe(0);
  });

  it("enables the local login only with all three locks open", () => {
    const local = { DEV_LOGIN: "true", FIRESTORE_DATABASE: "development" };
    expect(devLoginEnabled(local)).toBe(true);
    expect(devLoginEnabled({ ...local, K_SERVICE: "expensetracker-web" })).toBe(false);
    expect(devLoginEnabled({ ...local, FIRESTORE_DATABASE: "(default)" })).toBe(false);
    expect(devLoginEnabled({ ...local, DEV_LOGIN: "1" })).toBe(false);
  });

  it("maps default avatars from the Terraform setting", () => {
    const setting = "marcin@gmail.com=lion, agnieszka@gmail.com=PUMA, x@gmail.com=dragon";
    expect(defaultAvatar("Marcin@gmail.com", setting)).toBe("lion");
    expect(defaultAvatar("agnieszka@gmail.com", setting)).toBe("puma");
    expect(defaultAvatar("x@gmail.com", setting)).toBeUndefined();
  });
});

describe("Google OAuth", () => {
  it("builds an authorization URL with PKCE, state and nonce", () => {
    const state = newOAuthState("/together", 0);
    const url = new URL(authorizationUrl("client-id", "https://app.example/api/auth/google/callback", state));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(state.verifier).digest("base64url"));
    expect(url.searchParams.get("state")).toBe(state.state);
    expect(url.searchParams.get("nonce")).toBe(state.nonce);
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(state.exp).toBe(600_000);
  });

  it("uses fresh random values every time", () => {
    const [a, b] = [newOAuthState("/"), newOAuthState("/")];
    expect(a.state).not.toBe(b.state);
    expect(a.verifier).not.toBe(b.verifier);
    expect(pkceChallenge(a.verifier)).not.toBe(a.verifier);
  });

  it("never redirects off-site after login", () => {
    expect(safeNext("/expenses?month=2026-11")).toBe("/expenses?month=2026-11");
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "", null]) expect(safeNext(evil)).toBe("/");
  });

  it("accepts only verified, allowed e-mails with the right nonce", () => {
    const allowed = new Set(["marcin@gmail.com"]);
    const good = { email: "Marcin@gmail.com", email_verified: true, nonce: "n" };
    expect(checkIdentity(good, "n", allowed)).toEqual({ ok: true, email: "marcin@gmail.com" });
    expect(checkIdentity({ ...good, nonce: "other" }, "n", allowed)).toEqual({ ok: false, reason: "nonce" });
    expect(checkIdentity({ ...good, email_verified: false }, "n", allowed)).toEqual({ ok: false, reason: "unverified" });
    expect(checkIdentity({ ...good, email: "stranger@gmail.com" }, "n", allowed)).toEqual({ ok: false, reason: "denied" });
  });
});

describe("rate limiting", () => {
  it("blocks after the limit and frees the window later", () => {
    resetRateLimits();
    for (let i = 0; i < 3; i++) expect(isRateLimited("k", { max: 3, seconds: 60 }, 1_000)).toBe(false);
    expect(isRateLimited("k", { max: 3, seconds: 60 }, 1_000)).toBe(true);
    expect(isRateLimited("k", { max: 3, seconds: 60 }, 62_000)).toBe(false);
  });

  it("trusts only the address appended by Cloud Run", () => {
    expect(clientAddress(new Headers({ "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4");
  });
});
