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
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 4,
          select: { image: { select: { storageKey: true } } },
        }),
      ]);
      return { platform, gameCount, recentCoverKeys: recent.map((g) => g.image.storageKey).reverse() };
    }),
  );
}
