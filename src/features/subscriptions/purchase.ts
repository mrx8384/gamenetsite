import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { nextGrantStart } from "./entitlement-rules";

/** How long a started subscription payment stays payable. */
export const SUBSCRIPTION_PAYMENT_MINUTES = 20;

type Result = { ok: true; referenceId: string; cardPanMasked?: string; raw?: unknown } | { ok: false; reason: string; raw?: unknown };

/**
 * Gateway result for a subscription purchase. The subscription row waits as INACTIVE; when the money is
 * confirmed it becomes ACTIVE, queued after the partner's current period (same rule as manual grants).
 * A payment that arrives after the window still activates it: nothing is in limited supply.
 */
export async function applySubscriptionPayment(paymentId: string, result: Result): Promise<"paid" | "failed" | "already_processed"> {
  const sub = await db.partnerSubscription.findUnique({ where: { paymentId }, select: { id: true, partnerId: true } });
  if (!sub) throw new Error("payment_without_subscription");

  if (!result.ok) {
    const changed = await db.$transaction(async (tx) => {
      const c = await tx.payment.updateMany({ where: { id: paymentId, status: "INITIATED" }, data: { status: "FAILED", raw: (result.raw ?? { reason: result.reason }) as Prisma.InputJsonValue } });
      if (c.count) await tx.partnerSubscription.updateMany({ where: { id: sub.id, status: "INACTIVE" }, data: { status: "CANCELLED", note: `پرداخت ناموفق (${result.reason})`.slice(0, 500) } });
      return c.count > 0;
    });
    return changed ? "failed" : "already_processed";
  }

  return db.$transaction(async (tx) => {
    const c = await tx.payment.updateMany({
      where: { id: paymentId, status: "INITIATED" },
      data: { status: "SUCCEEDED", referenceId: result.referenceId, cardPanMasked: result.cardPanMasked ?? null, raw: (result.raw ?? {}) as Prisma.InputJsonValue },
    });
    if (!c.count) return "already_processed" as const;
    // Same lock as manual grants, so two purchases/grants can't overlap their periods.
    await tx.$queryRaw`SELECT id FROM partner_profiles WHERE id = ${sub.partnerId} FOR UPDATE`;
    const current = await tx.partnerSubscription.findUniqueOrThrow({ where: { id: sub.id }, select: { status: true, plan: { select: { durationDays: true, name: true } } } });
    if (current.status === "ACTIVE") return "already_processed" as const;
    const active = await tx.partnerSubscription.findMany({ where: { partnerId: sub.partnerId, status: "ACTIVE" }, select: { status: true, startsAt: true, endsAt: true } });
    const startsAt = nextGrantStart(active);
    const endsAt = new Date(startsAt.getTime() + current.plan.durationDays * 86_400_000);
    await tx.partnerSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", startsAt, endsAt, note: `خرید آنلاین — کد پیگیری ${result.referenceId}`.slice(0, 500) } });
    return "paid" as const;
  });
}

/** Unpaid purchases older than the window are cancelled (maintenance + before a new purchase). */
export async function expireStaleSubscriptionPurchases(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SUBSCRIPTION_PAYMENT_MINUTES * 60_000);
  const { count } = await db.partnerSubscription.updateMany({
    where: { status: "INACTIVE", paymentId: { not: null }, payment: { status: "INITIATED", createdAt: { lt: cutoff } } },
    data: { status: "CANCELLED", note: "مهلت پرداخت تمام شد" },
  });
  return count;
}
