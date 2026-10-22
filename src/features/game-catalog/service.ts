import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_CATEGORY, normalizeCategoryName, PLATFORMS, type Platform } from "./constants";

type Client = Prisma.TransactionClient | typeof db;

/** Every platform always has its locked «بدون دسته» category (as in the original). */
export async function ensureDefaultCategories(tx: Client = db): Promise<void> {
  for (const platform of PLATFORMS) {
    const exists = await tx.catalogCategory.findFirst({ where: { platform, isDefault: true }, select: { id: true } });
    if (!exists) {
      await tx.catalogCategory.upsert({
        where: { platform_name: { platform, name: DEFAULT_CATEGORY } },
        create: { platform, name: DEFAULT_CATEGORY, isDefault: true, position: 0 },
        update: { isDefault: true },
      });
    }
  }
}

/** Original `cat_id()`: finds a category by name on a platform or creates it at the end. */
export async function getOrCreateCategory(tx: Client, platform: Platform, rawName: unknown): Promise<number> {
  const name = normalizeCategoryName(rawName);
  const found = await tx.catalogCategory.findUnique({ where: { platform_name: { platform, name } }, select: { id: true } });
  if (found) return found.id;
  const max = await tx.catalogCategory.aggregate({ where: { platform }, _max: { position: true } });
  const created = await tx.catalogCategory.create({
    data: { platform, name, position: (max._max.position ?? 0) + 1, isDefault: name === DEFAULT_CATEGORY },
    select: { id: true },
  });
  return created.id;
}

/** 12 lowercase hex chars, same format as the original IDs. */
export async function newGameId(tx: Client = db): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const id = randomBytes(6).toString("hex");
    if (!(await tx.catalogGame.findUnique({ where: { id }, select: { id: true } }))) return id;
  }
  throw new Error("Could not allocate a catalog game id");
}

export async function defaultCategoryId(tx: Client, platform: Platform): Promise<number> {
  await ensureDefaultCategories(tx);
  const c = await tx.catalogCategory.findFirstOrThrow({ where: { platform, isDefault: true }, select: { id: true } });
  return c.id;
}

/** Next position at the end of the list (new games appear last, like the original). */
export async function nextGamePosition(tx: Client = db): Promise<number> {
  const max = await tx.catalogGame.aggregate({ _max: { position: true } });
  return (max._max.position ?? 0) + 1;
}
