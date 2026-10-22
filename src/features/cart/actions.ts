"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { getCommerceSettings } from "@/features/settings/commerce";
import { getPaymentProvider } from "@/features/payments";
import { findCartId, getOrCreateCartId, MAX_QTY_PER_ITEM } from "./service";

const SALES_CLOSED = "فروش آنلاین در حال حاضر فعال نیست.";

async function salesOpen(): Promise<boolean> {
  const settings = await getCommerceSettings();
  return settings.salesEnabled && !!getPaymentProvider();
}

const addSchema = z.object({ productId: z.string().min(1).max(50), quantity: z.number().int().min(1).max(MAX_QTY_PER_ITEM) });

export async function addToCart(input: unknown): Promise<ActionResult<{ count: number }>> {
  if (!(await salesOpen())) return fail(SALES_CLOSED);
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return fail("درخواست نامعتبر است.");
  const { ip } = await getRequestInfo();
  if (!(await rateLimit(`cart:${ip}`, 120, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { status: true, stock: true, category: { select: { priceOnRequest: true, parent: { select: { priceOnRequest: true } } } } },
  });
  if (!product || product.status !== "ACTIVE") return fail("این محصول در دسترس نیست.");
  if (product.category && (product.category.priceOnRequest || product.category.parent?.priceOnRequest)) {
    return fail("برای این محصول جهت استعلام قیمت تماس بگیرید.");
  }
  if (product.stock <= 0) return fail("این محصول ناموجود است.");

  const session = await getSession();
  const cartId = await getOrCreateCartId(session?.user.id ?? null);
  const existing = await db.cartItem.findUnique({ where: { cartId_productId: { cartId, productId: parsed.data.productId } } });
  const quantity = Math.min(MAX_QTY_PER_ITEM, product.stock, (existing?.quantity ?? 0) + parsed.data.quantity);
  await db.cartItem.upsert({
    where: { cartId_productId: { cartId, productId: parsed.data.productId } },
    create: { cartId, productId: parsed.data.productId, quantity },
    update: { quantity },
  });
  const agg = await db.cartItem.aggregate({ where: { cartId }, _sum: { quantity: true } });
  revalidatePath("/cart");
  const capped = quantity < (existing?.quantity ?? 0) + parsed.data.quantity;
  return ok({ count: agg._sum.quantity ?? 0 }, capped ? "به سقف موجودی/تعداد مجاز رسیدید." : "به سبد خرید اضافه شد.");
}

async function ownedItem(itemId: string) {
  const session = await getSession();
  const cartId = await findCartId(session?.user.id ?? null);
  if (!cartId) return null;
  return db.cartItem.findFirst({ where: { id: itemId, cartId }, select: { id: true, productId: true } });
}

export async function updateCartItem(itemId: string, quantity: number): Promise<ActionResult<undefined>> {
  if (typeof itemId !== "string" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_ITEM) return fail("تعداد نامعتبر است.");
  const item = await ownedItem(itemId);
  if (!item) return fail("این مورد در سبد شما نیست.");
  const product = await db.product.findUnique({ where: { id: item.productId }, select: { stock: true } });
  if (!product || quantity > product.stock) return fail("این تعداد در انبار موجود نیست.");
  await db.cartItem.update({ where: { id: item.id }, data: { quantity } });
  revalidatePath("/cart");
  return ok(undefined);
}

export async function removeCartItem(itemId: string): Promise<ActionResult<undefined>> {
  if (typeof itemId !== "string") return fail("درخواست نامعتبر است.");
  const item = await ownedItem(itemId);
  if (!item) return fail("این مورد در سبد شما نیست.");
  await db.cartItem.delete({ where: { id: item.id } });
  revalidatePath("/cart");
  return ok(undefined, "از سبد خرید حذف شد.");
}
