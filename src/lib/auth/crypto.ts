import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** 256-bit random token, base64url. Used for session cookies. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacHex(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

/** Uniformly random numeric code, zero-padded (e.g. "048213"). */
export function generateNumericCode(length = 6): string {
  return randomInt(0, 10 ** length).toString().padStart(length, "0");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
