import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { db } from "@/lib/db";
import { deleteUnusedMedia, storeImage, UploadError } from "@/features/media/storage";
import { DEFAULT_CATEGORY, GAME_NAME_MAX, normalizeCategoryName, type Platform } from "./constants";
import { ensureDefaultCategories } from "./service";

export class CatalogImportError extends Error {}

interface SourceCategory { id: number; platform: Platform; name: string; position: number }
interface SourceGame { id: string; name: string; categoryId: number; platform: Platform; image: Uint8Array; createdAt: number | null; updatedAt: number | null }

export interface ImportSummary {
  runId: string;
  schemaVersion: number;
  sourceSha256: string;
  categories: number;
  games: { PS4: number; PS5: number };
  skipped: { id: string; name: string; reason: string }[];
  renamedIds: number;
}

const toPlatform = (v: unknown): Platform => (String(v ?? "").toLowerCase() === "ps5" ? "PS5" : "PS4");

/** Reads the original catalog.db (schema v1 or v2). The file is opened read-only and never modified. */
export function readSourceDatabase(filePath: string): { version: number; categories: SourceCategory[]; games: SourceGame[] } {
  let src: DatabaseSync;
  try {
    src = new DatabaseSync(filePath, { readOnly: true });
  } catch {
    throw new CatalogImportError("فایل یک دیتابیس SQLite معتبر نیست.");
  }
  try {
    const integrity = (src.prepare("PRAGMA integrity_check").get() as { integrity_check?: string } | undefined)?.integrity_check;
    if (integrity !== "ok") throw new CatalogImportError("فایل دیتابیس آسیب دیده است (integrity_check ناموفق).");
    const tables = new Set((src.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name));
    if (!tables.has("games") || !tables.has("categories")) throw new CatalogImportError("این فایل دیتابیس کاتالوگ آتم نیست (جدول games یا categories پیدا نشد).");
    const version = Number((src.prepare("PRAGMA user_version").get() as { user_version: number }).user_version ?? 0);
    const cols = (t: string) => new Set((src.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name));
    const catHasPlatform = cols("categories").has("platform");
    const gameHasPlatform = cols("games").has("platform");

    // v1 (no platforms): everything goes to PS4 — same as the original migration.
    const categories = (src.prepare(`SELECT id, name, position${catHasPlatform ? ", platform" : ""} FROM categories ORDER BY id`).all() as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      platform: catHasPlatform ? toPlatform(r.platform) : ("PS4" as Platform),
      name: normalizeCategoryName(r.name),
      position: Number(r.position ?? 0),
    }));
    const games = (src.prepare(`SELECT id, name, category_id, image, created_at, updated_at${gameHasPlatform ? ", platform" : ""} FROM games ORDER BY rowid`).all() as Record<string, unknown>[]).map((r) => ({
      id: String(r.id ?? ""),
      name: String(r.name ?? "").trim().slice(0, GAME_NAME_MAX),
      categoryId: Number(r.category_id),
      platform: gameHasPlatform ? toPlatform(r.platform) : ("PS4" as Platform),
      image: r.image instanceof Uint8Array ? r.image : new Uint8Array(),
      createdAt: r.created_at == null ? null : Number(r.created_at),
      updatedAt: r.updated_at == null ? null : Number(r.updated_at),
    }));
    return { version, categories, games };
  } catch (e) {
    // SQLite errors ("file is not a database", missing columns, ...) become a clear message for the admin.
    if (e instanceof CatalogImportError) throw e;
    throw new CatalogImportError("فایل یک دیتابیس SQLite معتبر کاتالوگ نیست.");
  } finally {
    src.close();
  }
}

/**
 * Imports a catalog.db, REPLACING the current catalog (the owner's chosen migration path).
 * Images are stored first; the DB swap happens in one transaction; on failure new files are removed.
 */
export async function importCatalogDatabase(filePath: string, opts: { fileName: string; actorId: string | null }): Promise<ImportSummary> {
  const sourceSha256 = createHash("sha256").update(await readFile(filePath)).digest("hex");
  const { version, categories, games } = readSourceDatabase(filePath);
  if (games.length === 0) throw new CatalogImportError("این فایل هیچ بازی‌ای ندارد.");
  if (games.length > 20000) throw new CatalogImportError("تعداد بازی‌ها بیش از حد مجاز است.");

  const skipped: ImportSummary["skipped"] = [];
  const stored: { game: SourceGame; mediaId: string }[] = [];
  const createdMedia: string[] = [];
  try {
    for (const game of games) {
      if (game.image.byteLength === 0) {
        skipped.push({ id: game.id, name: game.name, reason: "بدون تصویر" });
        continue;
      }
      try {
        const media = await storeImage(Buffer.from(game.image), { folder: "catalog", uploaderId: opts.actorId, maxWidth: 720, originalName: `${game.id}.jpg` });
        createdMedia.push(media.id);
        stored.push({ game, mediaId: media.id });
      } catch (e) {
        skipped.push({ id: game.id, name: game.name, reason: e instanceof UploadError ? e.message : "خطا در پردازش تصویر" });
      }
    }

    const previousMedia = (await db.catalogGame.findMany({ select: { imageId: true } })).map((g) => g.imageId);
    const seenIds = new Set<string>();
    let renamedIds = 0;

    const result = await db.$transaction(
      async (tx) => {
        await tx.catalogGame.deleteMany({});
        await tx.catalogCategory.deleteMany({});
        const run = await tx.catalogImportRun.create({
          data: { sourceFileName: opts.fileName.slice(0, 255), sourceSha256, schemaVersion: version, gamesImported: stored.length, categoriesImported: categories.length, actorId: opts.actorId },
          select: { id: true },
        });

        // Categories keep their names and order per platform.
        const idMap = new Map<number, number>(); // source category id → new id
        for (const c of [...categories].sort((a, b) => a.position - b.position || a.id - b.id)) {
          const created = await tx.catalogCategory.upsert({
            where: { platform_name: { platform: c.platform, name: c.name } },
            create: { platform: c.platform, name: c.name, position: c.position, isDefault: c.name === DEFAULT_CATEGORY },
            update: {},
            select: { id: true },
          });
          idMap.set(c.id, created.id);
        }
        await ensureDefaultCategories(tx);

        let position = 0;
        for (const { game, mediaId } of stored) {
          position++;
          // Keep original IDs; regenerate only if invalid or duplicated.
          let id = /^[0-9a-f]{12}$/.test(game.id) && !seenIds.has(game.id) ? game.id : "";
          if (!id) {
            renamedIds++;
            do id = [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");
            while (seenIds.has(id));
          }
          seenIds.add(id);

          // A game must sit in a category of its own platform (as the original enforced).
          let categoryId = idMap.get(game.categoryId);
          const srcCat = categories.find((c) => c.id === game.categoryId);
          if (!categoryId || (srcCat && srcCat.platform !== game.platform)) {
            const name = srcCat?.name ?? DEFAULT_CATEGORY;
            const c = await tx.catalogCategory.upsert({
              where: { platform_name: { platform: game.platform, name } },
              create: { platform: game.platform, name, position: 999, isDefault: name === DEFAULT_CATEGORY },
              update: {},
              select: { id: true },
            });
            categoryId = c.id;
          }
          const created = game.createdAt ? new Date(game.createdAt * 1000) : new Date();
          await tx.catalogGame.create({
            data: {
              id,
              name: game.name,
              platform: game.platform,
              categoryId,
              imageId: mediaId,
              position, // original rowid order (ties in created_at are common after bulk uploads)
              importRunId: run.id,
              createdAt: created,
              updatedAt: game.updatedAt ? new Date(game.updatedAt * 1000) : created,
            },
          });
        }
        return run.id;
      },
      { timeout: 120_000 },
    );

    await deleteUnusedMedia(previousMedia); // old catalog images no longer referenced
    const count = (p: Platform) => stored.filter((s) => s.game.platform === p).length;
    return { runId: result, schemaVersion: version, sourceSha256, categories: categories.length, games: { PS4: count("PS4"), PS5: count("PS5") }, skipped, renamedIds };
  } catch (e) {
    await deleteUnusedMedia(createdMedia); // roll back stored files
    throw e;
  }
}
