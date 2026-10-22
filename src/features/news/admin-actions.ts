"use server";

import { updateTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, GENERIC_ERROR, isUniqueViolation, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { renderRichText } from "@/lib/rich-text/render";
import { newsCategorySchema, newsPostSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

export async function saveNewsCategory(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = newsCategorySchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  try {
    const saved = id
      ? await db.newsCategory.update({ where: { id }, data: parsed.data, select: { id: true } })
      : await db.newsCategory.create({ data: parsed.data, select: { id: true } });
    updateTag(CACHE_TAGS.news);
    return ok(saved, "دسته ذخیره شد.");
  } catch (error) {
    if (isUniqueViolation(error)) return fail("این نامک تکراری است.", { slug: "این نامک تکراری است." });
    console.error("[news] saveNewsCategory", error);
    return fail(GENERIC_ERROR);
  }
}

export async function deleteNewsCategory(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const { count } = await db.newsCategory.deleteMany({ where: { id } }); // posts keep existing (category set to null)
  if (!count) return fail("دسته پیدا نشد.");
  updateTag(CACHE_TAGS.news);
  return ok(undefined, "دسته حذف شد. اخبار آن بدون دسته باقی ماندند.");
}

export async function saveNewsPost(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = newsPostSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { content, excerpt, ...rest } = parsed.data;
  const rendered = renderRichText(content);
  if (!rendered) return fail("محتوای خبر نامعتبر است.");
  if (rest.status === "PUBLISHED" && rendered.plain.length < 20) {
    return fail("متن خبر برای انتشار خیلی کوتاه است.", { content: "حداقل ۲۰ کاراکتر متن لازم است." });
  }
  if (rest.coverMediaId && !(await db.media.findUnique({ where: { id: rest.coverMediaId }, select: { id: true } }))) {
    return fail("تصویر شاخص پیدا نشد. دوباره بارگذاری کنید.");
  }

  const existing = id ? await db.newsPost.findUnique({ where: { id }, select: { publishedAt: true } }) : null;
  if (id && !existing) return fail("خبر پیدا نشد.");
  const data = {
    ...rest,
    excerpt: excerpt || rendered.plain.slice(0, 220) || null,
    contentJson: rendered.json as unknown as Prisma.InputJsonValue,
    contentHtml: rendered.html,
    // First publication sets the date; later edits keep it.
    publishedAt: rest.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
  };
  try {
    const saved = id
      ? await db.newsPost.update({ where: { id }, data, select: { id: true } })
      : await db.newsPost.create({ data: { ...data, authorId: user.id }, select: { id: true } });
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: id ? "news.updated" : "news.created", entity: "news_post", entityId: saved.id, ip, meta: { status: rest.status } });
    updateTag(CACHE_TAGS.news);
    return ok(saved, rest.status === "PUBLISHED" ? "خبر ذخیره و منتشر شد." : "پیش‌نویس ذخیره شد.");
  } catch (error) {
    if (isUniqueViolation(error)) return fail("این نامک تکراری است.", { slug: "این نامک تکراری است." });
    console.error("[news] saveNewsPost", error);
    return fail(GENERIC_ERROR);
  }
}

export async function deleteNewsPost(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const { count } = await db.newsPost.deleteMany({ where: { id } });
  if (!count) return fail("خبر پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "news.deleted", entity: "news_post", entityId: id, ip });
  updateTag(CACHE_TAGS.news);
  return ok(undefined, "خبر حذف شد.");
}
