import { describe, expect, it } from "vitest";
import { generateNumericCode, generateToken, hmacHex, safeEqualHex, sha256Hex } from "@/lib/auth/crypto";
import { passwordSchema } from "@/lib/auth/password-policy";

describe("auth crypto", () => {
  it("generates unique 256-bit tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });
  it("generates 6-digit zero-padded codes", () => {
    for (let i = 0; i < 200; i++) expect(generateNumericCode()).toMatch(/^\d{6}$/);
  });
  it("hashes deterministically and compares in constant time", () => {
    expect(sha256Hex("x")).toHaveLength(64);
    const h = hmacHex("secret", "LOGIN:09121234567:123456");
    expect(safeEqualHex(h, hmacHex("secret", "LOGIN:09121234567:123456"))).toBe(true);
    expect(safeEqualHex(h, hmacHex("secret", "LOGIN:09121234567:123457"))).toBe(false);
    expect(safeEqualHex(h, "abcd")).toBe(false);
  });
});

describe("password policy", () => {
  it("requires length, a letter and a digit", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("atom2021club").success).toBe(true);
    expect(passwordSchema.safeParse("رمزعبور۱۴۰۵").success).toBe(true);
  });
});
