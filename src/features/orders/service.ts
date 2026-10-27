import "server-only";
import { randomInt } from "node:crypto";
import type { OrderStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { releaseForOrderTx } from "@/features/game-rewards/service";

export const PAYMENT_WINDOW_MINUTES = 20;
type Tx = Prisma.TransactionClient;

export class OrderError extends Error {}

export async function generateOrderNumber(tx: Tx): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const number = `ATM-${randomInt(100000, 1000000)}`;
    if (!(await tx.order.findUnique({ where: { number }, select: { id: true } }))) return number;
  }
  throw new OrderError("Could not allocate an order number");
}

/**
 * Releases the stock of an order and marks it CANCELLED (inside a transaction).
 * Safe to call twice: does nothing if the order is no longer cancellable.
 */
export async function cancelOrderTx(tx: Tx, orderId: string, actorId: string | null, note: string): Promise<boolean> {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, items: { select: { productId: true, quantity: true } } } });
  if (!order || !["PENDING", "AWAITING_PAYMENT", "PAID", "PROCESSING"].includes(order.status)) return false;
  const updated = await tx.order.updateMany({ where: { id: orderId, status: order.status }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  if (updated.count === 0) return false; // changed concurrently
  for (const item of order.items) {
    if (!item.productId) continue;
    await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    await tx.inventoryMovement.create({ data: { productId: item.productId, delta: item.quantity, reason: "ORDER_CANCEL", orderId, actorId } });
  }
  await tx.orderStatusHistory.create({ data: { orderId, from: order.status, to: "CANCELLED", actorId, note } });
  // a discount card used by this order can be used again (until it expires)
  await releaseForOrderTx(tx, orderId);
  return true;
}

/** Cancels unpaid orders whose payment window has passed and returns their stock. */
export async function expireStaleOrders(): Promise<number> {
  const stale = await db.order.findMany({
    where: { status: "AWAITING_PAYMENT", paymentDeadline: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  let n = 0;
  for (const o of stale) {
    const done = await db.$transaction((tx) => cancelOrderTx(tx, o.id, null, "لغو خودکار: مهلت پرداخت تمام شد"));
    if (done) n++;
  }
  return n;
}

/** Re-reserves stock for an order (used when a payment arrives after the order expired). */
async function tryReserveTx(tx: Tx, orderId: string): Promise<boolean> {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { productId: true, quantity: true } });
  for (const item of items) {
    if (!item.productId) return false;
    const rows = await tx.$queryRaw<{ id: string }[]>`
      UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.productId} AND stock >= ${item.quantity} RETURNING id`;
    if (rows.length === 0) throw new OrderError("insufficient_stock");
    await tx.inventoryMovement.create({ data: { productId: item.productId, delta: -item.quantity, reason: "ORDER", orderId, note: "رزرو مجدد پس از پرداخت دیرهنگام" } });
  }
  return true;
}

export type CallbackOutcome = { orderNumber: string; result: "paid" | "failed" | "late_paid_needs_refund" | "already_processed" };

/** Applies a verified gateway result to the payment and its order. Idempotent. */
export async function applyPaymentResult(
  paymentId: string,
  result: { ok: true; referenceId: string; cardPanMasked?: string; raw?: unknown } | { ok: false; reason: string; raw?: unknown },
): Promise<CallbackOutcome> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, select: { status: true, order: { select: { id: true, number: true, status: true } } } });
  if (!payment?.order) throw new OrderError("payment_without_order");
  const order = payment.order;
  if (payment.status !== "INITIATED") return { orderNumber: order.number, result: "already_processed" };

  if (!result.ok) {
    await db.$transaction(async (tx) => {
      const changed = await tx.payment.updateMany({ where: { id: paymentId, status: "INITIATED" }, data: { status: "FAILED", raw: (result.raw ?? { reason: result.reason }) as Prisma.InputJsonValue } });
      if (changed.count && order.status === "AWAITING_PAYMENT") await cancelOrderTx(tx, order.id, null, `پرداخت ناموفق (${result.reason})`);
    });
    return { orderNumber: order.number, result: "failed" };
  }

  let outcome: CallbackOutcome["result"] = "paid";
  await db.$transaction(async (tx) => {
    const changed = await tx.payment.updateMany({
      where: { id: paymentId, status: "INITIATED" },
      data: { status: "SUCCEEDED", referenceId: result.referenceId, cardPanMasked: result.cardPanMasked ?? null, raw: (result.raw ?? {}) as Prisma.InputJsonValue },
    });
    if (!changed.count) {
      outcome = "already_processed";
      return;
    }
    const current = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
    let from: OrderStatus = current.status;
    if (current.status === "CANCELLED") {
      // Paid after expiry: re-reserve stock if possible, otherwise flag for refund.
      try {
        await tryReserveTx(tx, order.id);
      } catch {
        await tx.order.update({ where: { id: order.id }, data: { adminNote: "پرداخت پس از لغو سفارش انجام شد و موجودی کافی نیست — نیاز به بازپرداخت." } });
        await tx.orderStatusHistory.create({ data: { orderId: order.id, from: "CANCELLED", to: "CANCELLED", note: "پرداخت دیرهنگام؛ نیاز به بازپرداخت" } });
        outcome = "late_paid_needs_refund";
        return;
      }
      from = "CANCELLED";
    } else if (current.status !== "AWAITING_PAYMENT") {
      outcome = "already_processed";
      return;
    }
    await tx.order.update({ where: { id: order.id }, data: { status: "PAID", paidAt: new Date(), cancelledAt: null } });
    await tx.orderStatusHistory.create({ data: { orderId: order.id, from, to: "PAID", note: `پرداخت موفق — کد پیگیری ${result.referenceId}` } });
  });
  return { orderNumber: order.number, result: outcome };
}
