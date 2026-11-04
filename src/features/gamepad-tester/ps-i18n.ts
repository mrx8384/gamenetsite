import fa from "@ds-tools/lang/fa_fa.json";

const FA = fa as Record<string, string>;

/** Persian for a text coming from the PlayStation controller code (English when no translation exists). */
export function tr(text: string | null | undefined): string {
  if (!text) return "";
  return FA[text] || text;
}

/** Plain text of a value that may carry markup from the controller code. Pure. */
export function plain(value: unknown): string {
  return String(value ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();
}
