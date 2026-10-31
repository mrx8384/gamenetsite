"use server";

import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { deleteUnusedMedia } from "@/features/media/storage";
import { attractionSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 40;
const NOT_FOUND = "بخش پیدا نشد.";

export async function saveAttraction(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = attractionSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات را بررسی کنید.", zodFieldErrors(parsed.error.issues));
  const { keepStaticImage, ...data } = parsed.data;
  if (data.imageId && !(await db.media.findUnique({ where: { id: data.imageId }, select: { id: true } }))) {
    return fail("تصویر پیدا نشد؛ دوباره بارگذاری کنید.");
  }

  let attractionId: string;
  let oldImage: string | null = null;
  if (id === null) {
    const last = await db.parkAttraction.aggregate({ _max: { sortOrder: true } });
    attractionId = (await db.parkAttraction.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } })).id;
  } else {
    if (!validId(id)) return fail(NOT_FOUND);
    const before = await db.parkAttraction.findUnique({ where: { id }, select: { imageId: true } });
    if (!before) return fail(NOT_FOUND);
    // An uploaded image replaces the built-in photo; removing the image removes both.
    await db.parkAttraction.update({ where: { id }, data: { ...data, ...(data.imageId || !keepStaticImage ? { staticImage: null } : {}) } });
    attractionId = id;
    oldImage = before.imageId !== data.imageId ? before.imageId : null;
  }
  if (oldImage) await deleteUnusedMedia([oldImage]);
  updateTag(CACHE_TAGS.park);
  await audit({ actorId: user.id, action: id === null ? "park.created" : "park.updated", entity: "park_attraction", entityId: attractionId, meta: { title: data.title } });
  return ok({ id: attractionId }, id === null ? "بخش اضافه شد." : "تغییرات ذخیره شد.");
}

export async function deleteAttraction(id: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (!validId(id)) return fail(NOT_FOUND);
  const row = await db.parkAttraction.findUnique({ where: { id }, select: { title: true, imageId: true } });
  if (!row) return fail(NOT_FOUND);
  await db.parkAttraction.delete({ where: { id } });
  if (row.imageId) await deleteUnusedMedia([row.imageId]);
  updateTag(CACHE_TAGS.park);
  await audit({ actorId: user.id, action: "park.deleted", entity: "park_attraction", entityId: id, meta: { title: row.title } });
  return ok(undefined, "بخش حذف شد.");
}

export async function moveAttraction(id: unknown, direction: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (!validId(id) || (direction !== "up" && direction !== "down")) return fail("درخواست نامعتبر است.");
  await db.$transaction(async (tx) => {
    const all = await tx.parkAttraction.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const i = all.findIndex((a) => a.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    for (const [n, a] of all.entries()) await tx.parkAttraction.update({ where: { id: a.id }, data: { sortOrder: n + 1 } });
  });
  updateTag(CACHE_TAGS.park);
  return ok(undefined);
}
