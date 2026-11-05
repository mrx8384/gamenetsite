/**
 * Display orders of the catalog (public pages and admin list). Pure, shared by client and server.
 * "newest" uses `position` (insertion order: every new game is placed last), so games imported in one
 * batch keep their original order instead of tying on createdAt.
 */
export const CATALOG_SORTS = ["category", "az", "newest"] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

export const CATALOG_SORT_LABELS: Record<CatalogSort, string> = {
  category: "دسته‌بندی",
  az: "الفبا (A تا Z)",
  newest: "جدیدترین",
};

// Latin names first (A→Z, numbers in numeric order), then Persian names in Persian alphabetical order.
const collator = new Intl.Collator(["en", "fa"], { sensitivity: "base", numeric: true });

export function sortCatalogGames<T extends { name: string; position: number }>(games: readonly T[], sort: CatalogSort): T[] {
  if (sort === "az") return [...games].sort((a, b) => collator.compare(a.name.trim(), b.name.trim()) || a.position - b.position);
  if (sort === "newest") return [...games].sort((a, b) => b.position - a.position);
  return [...games].sort((a, b) => a.position - b.position);
}

export const isCatalogSort = (v: unknown): v is CatalogSort => typeof v === "string" && (CATALOG_SORTS as readonly string[]).includes(v);
