import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type CatalogPlatformKey = "PS4" | "PS5";

export interface CatalogPlatformStats {
  platform: CatalogPlatformKey;
  gameCount: number;
  /** Most recent covers (storage keys), newest last — same as the original catalog home. */
  recentCoverKeys: string[];
}

export async function getCatalogStats(): Promise<CatalogPlatformStats[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.catalog);

  const platforms: CatalogPlatformKey[] = ["PS4", "PS5"];
  return Promise.all(
    platforms.map(async (platform) => {
      const [gameCount, recent] = await Promise.all([
        db.catalogGame.count({ where: { platform } }),
        db.catalogGame.findMany({
          where: { platform },
          orderBy: [{ position: "desc" }, { id: "desc" }],
          take: 4,
          select: { image: { select: { storageKey: true } } },
        }),
      ]);
      return { platform, gameCount, recentCoverKeys: recent.map((g) => g.image.storageKey).reverse() };
    }),
  );
}

// ───────────── Platform catalog ─────────────

export interface CatalogGameView {
  id: string;
  name: string;
  categoryId: number;
  imageKey: string;
  /** Cache-busting version (updatedAt seconds), like the original `v`. */
  v: number;
}

export interface CatalogPlatformView {
  categories: { id: number; name: string; isDefault: boolean }[];
  games: CatalogGameView[];
}

/** Categories in display order (default «بدون دسته» last, as in the original) and games in original order. */
export async function getCatalogPlatform(platform: CatalogPlatformKey): Promise<CatalogPlatformView> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.catalog);
  const [categories, games] = await Promise.all([
    db.catalogCategory.findMany({ where: { platform }, orderBy: [{ isDefault: "asc" }, { position: "asc" }, { id: "asc" }], select: { id: true, name: true, isDefault: true } }),
    db.catalogGame.findMany({
      where: { platform },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, name: true, categoryId: true, updatedAt: true, image: { select: { storageKey: true } } },
    }),
  ]);
  return {
    categories,
    games: games.map((g) => ({ id: g.id, name: g.name, categoryId: g.categoryId, imageKey: g.image.storageKey, v: Math.floor(g.updatedAt.getTime() / 1000) })),
  };
}

/** Cheap change marker for live refresh (not cached). */
export async function getCatalogVersion(platform: CatalogPlatformKey): Promise<string> {
  const agg = await db.catalogGame.aggregate({ where: { platform }, _count: true, _max: { updatedAt: true } });
  const cats = await db.catalogCategory.aggregate({ where: { platform }, _count: true, _max: { updatedAt: true } });
  return [agg._count, agg._max.updatedAt?.getTime() ?? 0, cats._count, cats._max.updatedAt?.getTime() ?? 0].join("-");
}
