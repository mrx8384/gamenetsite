"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, isUniqueViolation, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { deleteUnusedMedia, storeImage, UploadError } from "@/features/media/storage";
import { CATEGORY_MAX, DEFAULT_CATEGORY, GAME_NAME_MAX, nameFromFileName, PLATFORMS, type Platform } from "./constants";
import { defaultCategoryId, getOrCreateCategory, newGameId, nextGamePosition } from "./service";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const platformSchema = z.enum(PLATFORMS);
const nameSchema = z.string().trim().max(GAME_NAME_MAX);
const catNameSchema = z.string().trim().min(1, "نام دسته را وارد کنید").max(CATEGORY_MAX, "نام دسته حداکثر ۴۰ کاراکتر");

function changed(userId: string, action: string, entityId: string | null, meta?: Record<string, unknown>) {
  updateTag(CACHE_TAGS.catalog);
  void getRequestInfo().then(({ ip }) => audit({ actorId: userId, action: `catalog.${action}`, entity: "catalog", entityId, ip, meta: meta as never }));
}

// ───────────── Games ─────────────

/** Adds one game (bulk upload calls this once per file). Image is validated and re-encoded on the server. */
export async function addCatalogGame(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (!(await rateLimit(`catalog-upload:${user.id}`, 600, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const platform = platformSchema.safeParse(formData.get("platform"));
  const name = nameSchema.safeParse(String(formData.get("name") ?? ""));
  const file = formData.get("file");
  if (!platform.success || !name.success || !(file instanceof File) || file.size === 0) return fail("اطلاعات نامعتبر است.");

  let media;
  try {
    media = await storeImage(Buffer.from(await file.arrayBuffer()), { folder: "catalog", uploaderId: user.id, maxWidth: 720, originalName: file.name });
  } catch (e) {
    return fail(e instanceof UploadError ? `«${file.name}»: ${e.message}` : "ذخیرهٔ تصویر ناموفق بود.");
  }
  const game = await db.$transaction(async (tx) => {
    const categoryId = await getOrCreateCategory(tx, platform.data, formData.get("category"));
    return tx.catalogGame.create({
      data: { id: await newGameId(tx), name: name.data || nameFromFileName(file.name) || "بدون نام", platform: platform.data, categoryId, imageId: media.id, position: await nextGamePosition(tx) },
      select: { id: true },
    });
  });
  changed(user.id, "game_added", game.id);
  return ok(game, "بازی اضافه شد.");
}

const updateSchema = z.object({ name: nameSchema.min(1, "نام بازی را وارد کنید").optional(), category: z.string().max(200).optional(), platform: platformSchema.optional() });

/** Rename, change category, or move to the other platform (keeps the category name, like the original). */
export async function updateCatalogGame(id: string, input: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success || typeof id !== "string") return fail("اطلاعات نامعتبر است.");
  const game = await db.catalogGame.findUnique({ where: { id }, select: { platform: true, category: { select: { name: true } } } });
  if (!game) return fail("بازی پیدا نشد.");
  await db.$transaction(async (tx) => {
    const data: { name?: string; categoryId?: number; platform?: Platform } = {};
    if (parsed.data.name !== undefined) data.name = parsed.data.name;
    if (parsed.data.category !== undefined) data.categoryId = await getOrCreateCategory(tx, game.platform, parsed.data.category);
    if (parsed.data.platform && parsed.data.platform !== game.platform) {
      data.platform = parsed.data.platform;
      data.categoryId = await getOrCreateCategory(tx, parsed.data.platform, parsed.data.category ?? game.category.name);
    }
    await tx.catalogGame.update({ where: { id }, data });
  });
  changed(user.id, "game_updated", id, parsed.data);
  return ok(undefined, parsed.data.platform ? `به ${parsed.data.platform} منتقل شد.` : "ذخیره شد.");
}

export async function replaceCatalogGameImage(formData: FormData): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const id = String(formData.get("id") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("تصویری انتخاب نشده است.");
  const game = await db.catalogGame.findUnique({ where: { id }, select: { imageId: true } });
  if (!game) return fail("بازی پیدا نشد.");
  let media;
  try {
    media = await storeImage(Buffer.from(await file.arrayBuffer()), { folder: "catalog", uploaderId: user.id, maxWidth: 720, originalName: file.name });
  } catch (e) {
    return fail(e instanceof UploadError ? e.message : "ذخیرهٔ تصویر ناموفق بود.");
  }
  await db.catalogGame.update({ where: { id }, data: { imageId: media.id } });
  await deleteUnusedMedia([game.imageId]);
  changed(user.id, "game_image_replaced", id);
  return ok(undefined, "تصویر جایگزین شد.");
}

export async function deleteCatalogGame(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const game = await db.catalogGame.findUnique({ where: { id }, select: { imageId: true, name: true } });
  if (!game) return fail("بازی پیدا نشد.");
  await db.catalogGame.delete({ where: { id } });
  await deleteUnusedMedia([game.imageId]);
  changed(user.id, "game_deleted", id, { name: game.name });
  return ok(undefined, "بازی حذف شد.");
}

// ───────────── Categories ─────────────

export async function addCatalogCategory(platform: unknown, name: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const p = platformSchema.safeParse(platform);
  const n = catNameSchema.safeParse(name);
  if (!p.success) return fail("پلتفرم نامعتبر است.");
  if (!n.success) return fail(n.error.issues[0]?.message ?? "نام نامعتبر است.");
  if (n.data === DEFAULT_CATEGORY) return fail("این نام رزرو شده است.");
  await getOrCreateCategory(db, p.data, n.data);
  changed(user.id, "category_added", null, { platform: p.data, name: n.data });
  return ok(undefined, "دسته اضافه شد.");
}

/** Original rule: renaming to an existing name merges the two categories. The default category is locked. */
export async function renameCatalogCategory(id: number, newName: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const n = catNameSchema.safeParse(newName);
  if (!n.success || !Number.isInteger(id)) return fail(n.success ? "درخواست نامعتبر است." : (n.error.issues[0]?.message ?? "نام نامعتبر است."));
  const cat = await db.catalogCategory.findUnique({ where: { id } });
  if (!cat) return fail("دسته پیدا نشد.");
  if (cat.isDefault || n.data === DEFAULT_CATEGORY) return fail("دستهٔ «بدون دسته» قابل تغییر نام نیست.");
  if (n.data === cat.name) return ok(undefined, "تغییری ایجاد نشد.");
  let merged = false;
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.catalogCategory.findUnique({ where: { platform_name: { platform: cat.platform, name: n.data } } });
      if (existing) {
        await tx.catalogGame.updateMany({ where: { categoryId: cat.id }, data: { categoryId: existing.id } });
        await tx.catalogCategory.delete({ where: { id: cat.id } });
        merged = true;
      } else {
        await tx.catalogCategory.update({ where: { id: cat.id }, data: { name: n.data } });
      }
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("این نام هم‌زمان ثبت شد؛ دوباره تلاش کنید.");
    throw e;
  }
  changed(user.id, merged ? "category_merged" : "category_renamed", String(id), { to: n.data });
  return ok(undefined, merged ? `با دستهٔ «${n.data}» ادغام شد.` : "نام دسته تغییر کرد.");
}

/** Original rule: deleting a category moves its games to «بدون دسته» (games are never deleted). */
export async function deleteCatalogCategory(id: number): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const cat = Number.isInteger(id) ? await db.catalogCategory.findUnique({ where: { id } }) : null;
  if (!cat) return fail("دسته پیدا نشد.");
  if (cat.isDefault) return fail("دستهٔ «بدون دسته» قابل حذف نیست.");
  const moved = await db.$transaction(async (tx) => {
    const def = await defaultCategoryId(tx, cat.platform);
    const r = await tx.catalogGame.updateMany({ where: { categoryId: cat.id }, data: { categoryId: def } });
    await tx.catalogCategory.delete({ where: { id: cat.id } });
    return r.count;
  });
  changed(user.id, "category_deleted", String(id), { moved });
  return ok(undefined, moved ? `دسته حذف شد و ${moved.toLocaleString("fa-IR")} بازی به «بدون دسته» منتقل شد.` : "دسته حذف شد.");
}

/** Moves a category one step up/down in the display order. */
export async function moveCatalogCategory(id: number, direction: "up" | "down"): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const cat = Number.isInteger(id) ? await db.catalogCategory.findUnique({ where: { id } }) : null;
  if (!cat || cat.isDefault) return fail("این دسته قابل جابه‌جایی نیست.");
  const siblings = await db.catalogCategory.findMany({ where: { platform: cat.platform, isDefault: false }, orderBy: [{ position: "asc" }, { id: "asc" }], select: { id: true } });
  const i = siblings.findIndex((s) => s.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= siblings.length) return ok(undefined);
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await db.$transaction(siblings.map((s, idx) => db.catalogCategory.update({ where: { id: s.id }, data: { position: idx + 1 } })));
  changed(user.id, "category_moved", String(id), { direction });
  return ok(undefined);
}
