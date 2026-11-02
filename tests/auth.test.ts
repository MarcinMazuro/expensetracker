import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { DUMMY_HASH, hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { isRateLimited, resetRateLimits, clientAddress } from "@/lib/protection";
import { createToken, readToken } from "@/lib/token";
import { hashPassword as cliHash, DEFAULT_CATEGORIES as CLI_CATEGORIES } from "../scripts/create-user.mjs";

const SECRET = "x".repeat(40);

describe("passwords", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("anything", DUMMY_HASH)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });

  it("accepts hashes created by the CLI script", async () => {
    expect(await verifyPassword("from the terminal", await cliHash("from the terminal"))).toBe(true);
  });

  it("enforces a minimum length", () => {
    expect(passwordProblem("short")).not.toBeNull();
    expect(passwordProblem("long enough pass")).toBeNull();
  });
});

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

describe("CLI script", () => {
  it("seeds the same categories as the app", () => {
    expect(CLI_CATEGORIES).toEqual(DEFAULT_CATEGORIES);
  });
});
