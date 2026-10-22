import { toEnglishDigits } from "@/lib/format";

/** Unifies Arabic and Persian variants (ي/ك/ة...) so search and slugs match what users type. */
export function normalizePersian(input: string): string {
  return input
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/‌+/g, "‌") // collapse repeated ZWNJ
    .replace(/[ً-ْ]/g, "") // strip harakat
    .trim();
}

/**
 * URL slug that keeps Persian letters (modern browsers show them readably).
 * "دستهٔ DualSense سفید" → "دسته-dualsense-سفید"
 */
export function slugify(input: string): string {
  return normalizePersian(toEnglishDigits(input))
    .toLowerCase()
    .replace(/[‌\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export const SLUG_RE = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

/** Parses a Toman amount typed by an admin ("۱٬۲۵۰٬۰۰۰", "1,250,000") into Rials. Returns null if invalid. */
export function parseTomanToRial(input: string): bigint | null {
  const digits = toEnglishDigits(input).replace(/[\s,٬،.]/g, "");
  if (!/^\d{1,13}$/.test(digits)) return null;
  return BigInt(digits) * BigInt(10);
}
