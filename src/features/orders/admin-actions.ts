"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { ADMIN_TRANSITIONS, ORDER_STATUS_LABEL, type OrderStatusKey } from "./schemas";
import { buildTrackingUrl } from "@/features/shipping/schemas";
import { cancelOrderTx } from "./service";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const statusSchema = z.object({
  to: z.enum(["PENDING", "AWAITING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]),
  note: z.string().trim().max(500).default(""),
  trackingCode: z.string().trim().max(100).default(""),
});

export async function changeOrderStatus(orderId: string, input: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success || typeof orderId !== "string") return fail("درخواست نامعتبر است.");
  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true, shippingMethod: { select: { trackingUrl: true } } } });
  if (!order) return fail("سفارش پیدا نشد.");
  const { to, note, trackingCode } = parsed.data;
  if (!ADMIN_TRANSITIONS[order.status as OrderStatusKey].includes(to)) {
    return fail(`تغییر وضعیت از «${ORDER_STATUS_LABEL[order.status]}» به «${ORDER_STATUS_LABEL[to]}» مجاز نیست.`);
  }

  if (to === "CANCELLED") {
    const done = await db.$transaction((tx) => cancelOrderTx(tx, orderId, user.id, note || "لغو توسط مدیر"));
    if (!done) return fail("وضعیت سفارش هم‌زمان تغییر کرده است. صفحه را تازه کنید.");
    updateTag(CACHE_TAGS.products);
  } else {
    const changed = await db.$transaction(async (tx) => {
      const tracking =
        to === "SHIPPED" && trackingCode
          ? { trackingCode, trackingUrl: buildTrackingUrl(order.shippingMethod?.trackingUrl, trackingCode) }
          : {};
      const r = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: to, ...tracking } });
      if (r.count) await tx.orderStatusHistory.create({ data: { orderId, from: order.status, to, actorId: user.id, note: note || null } });
      return r.count;
    });
    if (!changed) return fail("وضعیت سفارش هم‌زمان تغییر کرده است. صفحه را تازه کنید.");
  }
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "orders.status_changed", entity: "order", entityId: orderId, ip, meta: { from: order.status, to } });
  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined, `وضعیت به «${ORDER_STATUS_LABEL[to]}» تغییر کرد.`);
}

export async function saveAdminNote(orderId: string, note: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (typeof orderId !== "string" || typeof note !== "string" || note.length > 2000) return fail("درخواست نامعتبر است.");
  await db.order.update({ where: { id: orderId }, data: { adminNote: note.trim() || null } });
  revalidatePath(`/admin/orders/${orderId}`);
  return ok(undefined, "یادداشت ذخیره شد.");
}

/**
 * Deletes an order placed with test payment credentials (`isTest`), e.g. while trying the Bale test wallet.
 * Real orders can never be deleted (sales records). Stock that the order still holds is returned first.
 */
export async function deleteTestOrder(orderId: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (typeof orderId !== "string" || !orderId) return fail("سفارش پیدا نشد.");
  const order = await db.order.findUnique({ where: { id: orderId }, select: { number: true, isTest: true, status: true } });
  if (!order) return fail("سفارش پیدا نشد.");
  if (!order.isTest) return fail("فقط سفارش‌های آزمایشی قابل حذف‌اند؛ سفارش واقعی برای حفظ سوابق فروش حذف نمی‌شود.");

  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    // Unpaid/paid/processing: the normal cancel returns stock and frees a discount card.
    const cancelled = await cancelOrderTx(tx, orderId, user.id, "حذف سفارش آزمایشی");
    if (!cancelled) {
      const current = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, items: { select: { productId: true, quantity: true } } } });
      // Shipped/delivered test orders still hold their stock.
      if (current.status === "SHIPPED" || current.status === "DELIVERED") {
        for (const item of current.items) {
          if (!item.productId) continue;
          await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          await tx.inventoryMovement.create({ data: { productId: item.productId, delta: item.quantity, reason: "CORRECTION", note: `حذف سفارش آزمایشی ${order.number}`, actorId: user.id } });
        }
      }
    }
    await tx.payment.deleteMany({ where: { orderId } });
    await tx.inventoryMovement.updateMany({ where: { orderId }, data: { note: `سفارش آزمایشی ${order.number} (حذف‌شده)` } });
    await tx.order.delete({ where: { id: orderId } }); // items + status history cascade
  });
  updateTag(CACHE_TAGS.products);
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "orders.test_deleted", entity: "order", entityId: orderId, ip, meta: { number: order.number, status: order.status } });
  return ok(undefined, `سفارش آزمایشی ${order.number} حذف شد.`);
}
