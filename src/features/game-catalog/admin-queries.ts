import "server-only";
import { db } from "@/lib/db";
import { looksLikeFileName, type Platform } from "./constants";
import { ensureDefaultCategories } from "./service";

export interface AdminCatalogCategory {
  id: number;
  name: string;
  isDefault: boolean;
  gameCount: number;
}

export interface AdminCatalogGame {
  id: string;
  name: string;
  categoryName: string;
  imageKey: string;
  needsRename: boolean;
  updatedAt: string;
}

/** Admin view of one platform. Not cached: the admin always sees the current state. */
export async function getAdminCatalog(platform: Platform) {
  await ensureDefaultCategories();
  const [categories, games, counts, lastImport] = await Promise.all([
    db.catalogCategory.findMany({
      where: { platform },
      orderBy: [{ isDefault: "asc" }, { position: "asc" }, { id: "asc" }],
      select: { id: true, name: true, isDefault: true, _count: { select: { games: true } } },
    }),
    db.catalogGame.findMany({
      where: { platform },
      orderBy: [{ position: "desc" }, { id: "desc" }], // newest first in the admin list
      select: { id: true, name: true, updatedAt: true, category: { select: { name: true } }, image: { select: { storageKey: true } } },
    }),
    db.catalogGame.groupBy({ by: ["platform"], _count: true }),
    db.catalogImportRun.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, sourceFileName: true, gamesImported: true } }),
  ]);
  return {
    categories: categories.map((c): AdminCatalogCategory => ({ id: c.id, name: c.name, isDefault: c.isDefault, gameCount: c._count.games })),
    games: games.map(
      (g): AdminCatalogGame => ({
        id: g.id,
        name: g.name,
        categoryName: g.category.name,
        imageKey: g.image.storageKey,
        needsRename: looksLikeFileName(g.name),
        updatedAt: g.updatedAt.toISOString(),
      }),
    ),
    totals: { PS4: counts.find((c) => c.platform === "PS4")?._count ?? 0, PS5: counts.find((c) => c.platform === "PS5")?._count ?? 0 },
    lastImport,
  };
}
