/** Rules carried over from the original catalog (see docs/GAME_CATALOG_ANALYSIS.md). */
export const DEFAULT_CATEGORY = "بدون دسته";
export const CATEGORY_MAX = 40;
export const GAME_NAME_MAX = 80;
export const PLATFORMS = ["PS4", "PS5"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function platformFromSlug(slug: string): Platform | null {
  const p = slug.toUpperCase();
  return (PLATFORMS as readonly string[]).includes(p) ? (p as Platform) : null;
}

/** Category input as in the original: trimmed, max 40 chars, empty → «بدون دسته». */
export function normalizeCategoryName(input: unknown): string {
  return (typeof input === "string" ? input.trim() : "").slice(0, CATEGORY_MAX) || DEFAULT_CATEGORY;
}

/** Game name from a bulk-uploaded file name (original behavior): strip extension, _ and - become spaces. */
export function nameFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, GAME_NAME_MAX);
}

/** Names that look like camera/file defaults and probably need renaming (e.g. "images", "IMG_1234"). */
export function looksLikeFileName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return /^(images?|img|photo|picture|screenshot|download|untitled|new)(\s*\(?\d+\)?)?$/.test(n) || /^(img|dsc|pxl|wp)[\s_-]*\d+/.test(n) || /^\d+$/.test(n) || /\b\d{2,4}\s*[x×]\s*\d{2,4}\b/.test(n);
}
