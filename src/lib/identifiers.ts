import { toEnglishDigits } from "@/lib/format";

/**
 * Normalizes an Iranian mobile number to the 11-digit form 09XXXXXXXXX.
 * Accepts Persian/Arabic digits, spaces/dashes, +98 / 0098 / 98 prefixes and the bare 9XXXXXXXXX form.
 * Returns null when the input is not a valid Iranian mobile number.
 */
export function normalizeIranMobile(input: string): string | null {
  let s = toEnglishDigits(input).replace(/[\s\-()]/g, "");
  if (s.startsWith("+98")) s = s.slice(3);
  else if (s.startsWith("0098")) s = s.slice(4);
  else if (s.startsWith("98") && s.length === 12) s = s.slice(2);
  if (s.length === 10 && s.startsWith("9")) s = `0${s}`;
  return /^09\d{9}$/.test(s) ? s : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(input: string): string | null {
  const s = toEnglishDigits(input).trim().toLowerCase();
  return s.length <= 254 && EMAIL_RE.test(s) ? s : null;
}

export type Identifier = { kind: "phone"; value: string } | { kind: "email"; value: string };

/** Parses a login identifier typed into a single "email or mobile" field. */
export function parseIdentifier(input: string): Identifier | null {
  const raw = input.trim();
  if (raw.includes("@")) {
    const email = normalizeEmail(raw);
    return email ? { kind: "email", value: email } : null;
  }
  const phone = normalizeIranMobile(raw);
  return phone ? { kind: "phone", value: phone } : null;
}

/** Masks for display, e.g. 0912***4567, re***@gmail.com */
export function maskIdentifier(id: Identifier): string {
  if (id.kind === "phone") return `${id.value.slice(0, 4)}***${id.value.slice(-4)}`;
  const [user, domain] = id.value.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

/** Only allow same-site relative redirects (prevents open redirects). */
export function safeRedirectPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
