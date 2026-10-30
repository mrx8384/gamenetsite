import { normalizePersian } from "@/lib/text";

/** Most names one bulk paste may contain (largest bracket the UI is meant for, with room for typos). */
export const BULK_MAX_LINES = 256;

/** Comparison key: same player whatever the spacing, letter case or Arabic/Persian letter variant. */
export function participantKey(name: string): string {
  return normalizePersian(name).replace(/\s+/g, " ").toLowerCase();
}

/**
 * Splits pasted text into names: one per line (also «،» / «;» separated), list markers such as
 * "1. ", "۱-", "12)", "- ", "• " removed, spaces collapsed, empty lines and repeats dropped.
 */
export function parseBulkNames(text: string): { names: string[]; repeated: string[] } {
  const names: string[] = [];
  const repeated: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n|[،;؛]/)) {
    const name = raw
      .replace(/^\s*(?:[-–—•*·]+|[0-9۰-۹٠-٩]{1,3}\s*[.)\-–:])\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) continue;
    const key = participantKey(name);
    if (seen.has(key)) {
      repeated.push(name);
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return { names, repeated };
}
