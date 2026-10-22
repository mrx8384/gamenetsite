"use server";

import { updateTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, GENERIC_ERROR, isUniqueViolation, ok, uniqueViolationTarget, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { categorySchema, createProductSchema, productSchema, stockAdjustSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

function uniqueError(error: unknown): ActionResult<never> | null {
  if (!isUniqueViolation(error)) return null;
  if (uniqueViolationTarget(error).includes("sku")) return fail("این کد کالا قبلاً استفاده شده است.", { sku: "این کد کالا تکراری است." });
  return fail("این نامک قبلاً استفاده شده است.", { slug: "این نامک تکراری است." });
}

const plainDescription = (text: string) => (text ? { format: "plain", text } : undefined);

// ───────────── Categories ─────────────

export async function saveCategory(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const data = { ...parsed.data, description: parsed.data.description || null };

  if (id && data.parentId === id) return fail("دسته نمی‌تواند والد خودش باشد.", { parentId: "والد نامعتبر است." });
  if (data.parentId) {
    // Prevent cycles: the chosen parent must not be a descendant of this category.
    let cursor: string | null = data.parentId;
    for (let depth = 0; cursor && depth < 20; depth++) {
      if (cursor === id) return fail("انتخاب این والد باعث ایجاد حلقه می‌شود.", { parentId: "والد نامعتبر است." });
      const parent: { parentId: string | null } | null = await db.category.findUnique({ where: { id: cursor }, select: { parentId: true } });
      if (!parent) return fail("دستهٔ والد پیدا نشد.", { parentId: "والد نامعتبر است." });
      cursor = parent.parentId;
    }
  }

  try {
    const saved = id
      ? await db.category.update({ where: { id }, data, select: { id: true } })
      : await db.category.create({ data, select: { id: true } });
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: id ? "categories.updated" : "categories.created", entity: "category", entityId: saved.id, ip });
    updateTag(CACHE_TAGS.products);
    return ok(saved, "دسته ذخیره شد.");
  } catch (error) {
    const u = uniqueError(error);
    if (u) return u;
    console.error("[store] saveCategory", error);
    return fail(GENERIC_ERROR);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const category = await db.category.findUnique({ where: { id }, select: { _count: { select: { products: true, children: true } } } });
  if (!category) return fail("دسته پیدا نشد.");
  if (category._count.products > 0) return fail("این دسته محصول دارد. ابتدا محصولات را به دستهٔ دیگری منتقل کنید.");
  if (category._count.children > 0) return fail("این دسته زیرمجموعه دارد. ابتدا زیرمجموعه‌ها را جابه‌جا یا حذف کنید.");
  await db.category.delete({ where: { id } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "categories.deleted", entity: "category", entityId: id, ip });
  updateTag(CACHE_TAGS.products);
  return ok(undefined, "دسته حذف شد.");
}

// ───────────── Products ─────────────

async function assertMediaExists(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const found = await db.media.count({ where: { id: { in: ids } } });
  return found === new Set(ids).size;
}

export async function createProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = createProductSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { images, initialStock, description, price, compareAtPrice, ...rest } = parsed.data;
  if (!(await assertMediaExists(images.map((i) => i.mediaId)))) return fail("یکی از تصاویر پیدا نشد. دوباره بارگذاری کنید.");

  try {
    const product = await db.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          ...rest,
          shortDescription: rest.shortDescription || null,
          descriptionJson: plainDescription(description),
          price: BigInt(price),
          compareAtPrice: compareAtPrice ? BigInt(compareAtPrice) : null,
          stock: initialStock,
          images: { create: images.map((img, i) => ({ mediaId: img.mediaId, alt: img.alt || null, sortOrder: i })) },
        },
        select: { id: true },
      });
      if (initialStock > 0) {
        await tx.inventoryMovement.create({ data: { productId: p.id, delta: initialStock, reason: "MANUAL", note: "موجودی اولیه", actorId: user.id } });
      }
      return p;
    });
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: "products.created", entity: "product", entityId: product.id, ip });
    updateTag(CACHE_TAGS.products);
    return ok(product, "محصول ایجاد شد.");
  } catch (error) {
    const u = uniqueError(error);
    if (u) return u;
    console.error("[store] createProduct", error);
    return fail(GENERIC_ERROR);
  }
}

export async function updateProduct(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { images, description, price, compareAtPrice, ...rest } = parsed.data;
  if (!(await assertMediaExists(images.map((i) => i.mediaId)))) return fail("یکی از تصاویر پیدا نشد. دوباره بارگذاری کنید.");

  try {
    await db.$transaction([
      db.productImage.deleteMany({ where: { productId: id } }),
      db.product.update({
        where: { id },
        data: {
          ...rest,
          shortDescription: rest.shortDescription || null,
          descriptionJson: plainDescription(description) ?? Prisma.DbNull,
          price: BigInt(price),
          compareAtPrice: compareAtPrice ? BigInt(compareAtPrice) : null,
          images: { create: images.map((img, i) => ({ mediaId: img.mediaId, alt: img.alt || null, sortOrder: i })) },
        },
      }),
    ]);
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: "products.updated", entity: "product", entityId: id, ip });
    updateTag(CACHE_TAGS.products);
    return ok({ id }, "تغییرات ذخیره شد.");
  } catch (error) {
    const u = uniqueError(error);
    if (u) return u;
    console.error("[store] updateProduct", error);
    return fail(GENERIC_ERROR);
  }
}

export async function deleteProduct(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const product = await db.product.findUnique({ where: { id }, select: { _count: { select: { orderItems: true } } } });
  if (!product) return fail("محصول پیدا نشد.");
  if (product._count.orderItems > 0) return fail("این محصول در سفارش‌ها استفاده شده است. به‌جای حذف، وضعیت آن را «بایگانی» کنید.");
  await db.product.delete({ where: { id } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "products.deleted", entity: "product", entityId: id, ip });
  updateTag(CACHE_TAGS.products);
  return ok(undefined, "محصول حذف شد.");
}

/** Changes stock atomically and records the movement. Stock can never go below zero (DB CHECK). */
export async function adjustStock(productId: string, input: unknown): Promise<ActionResult<{ stock: number }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = stockAdjustSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { delta, reason, note } = parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ stock: number }[]>`
        UPDATE products SET stock = stock + ${delta}, "updatedAt" = now()
        WHERE id = ${productId} AND stock + ${delta} >= 0
        RETURNING stock`;
      if (rows.length === 0) return null;
      await tx.inventoryMovement.create({ data: { productId, delta, reason, note: note || null, actorId: user.id } });
      return rows[0];
    });
    if (!result) return fail("موجودی نمی‌تواند منفی شود (یا محصول پیدا نشد).", { delta: "مقدار کاهش بیشتر از موجودی است." });
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: "products.stock_adjusted", entity: "product", entityId: productId, ip, meta: { delta, reason } });
    updateTag(CACHE_TAGS.products);
    return ok({ stock: result.stock }, "موجودی به‌روزرسانی شد.");
  } catch (error) {
    console.error("[store] adjustStock", error);
    return fail(GENERIC_ERROR);
  }
}
