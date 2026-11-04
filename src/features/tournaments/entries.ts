import "server-only";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

/** How long a started (unpaid) registration holds a place. */
export const ENTRY_PAYMENT_MINUTES = 20;

type Tx = Prisma.TransactionClient;
type Result = { ok: true; referenceId: string; cardPanMasked?: string; raw?: unknown } | { ok: false; reason: string; raw?: unknown };

/** Places taken in a tournament: real participants + unpaid registrations still inside their window. */
export async function takenPlaces(tx: Tx, tournamentId: string, now = new Date()): Promise<number> {
  const [participants, holding] = await Promise.all([
    tx.tournamentParticipant.count({ where: { tournamentId } }),
    tx.tournamentEntry.count({ where: { tournamentId, status: "AWAITING_PAYMENT", paymentDeadline: { gt: now } } }),
  ]);
  return participants + holding;
}

/**
 * Gateway result for a paid registration. The player joins the tournament only now, inside a lock on the
 * tournament. If that is no longer possible (registration closed, full, name taken), the money is kept on
 * record as REFUND_NEEDED for an admin to return.
 */
export async function applyEntryPayment(paymentId: string, result: Result): Promise<"paid" | "failed" | "already_processed" | "late_paid_needs_refund"> {
  const entry = await db.tournamentEntry.findUnique({ where: { paymentId }, select: { id: true } });
  if (!entry) throw new Error("payment_without_entry");

  if (!result.ok) {
    const changed = await db.$transaction(async (tx) => {
      const c = await tx.payment.updateMany({ where: { id: paymentId, status: "INITIATED" }, data: { status: "FAILED", raw: (result.raw ?? { reason: result.reason }) as Prisma.InputJsonValue } });
      if (c.count) await tx.tournamentEntry.updateMany({ where: { id: entry.id, status: "AWAITING_PAYMENT" }, data: { status: "CANCELLED", note: `پرداخت ناموفق (${result.reason})`.slice(0, 300) } });
      return c.count > 0;
    });
    return changed ? "failed" : "already_processed";
  }

  const outcome = await db.$transaction(async (tx) => {
    const c = await tx.payment.updateMany({
      where: { id: paymentId, status: "INITIATED" },
      data: { status: "SUCCEEDED", referenceId: result.referenceId, cardPanMasked: result.cardPanMasked ?? null, raw: (result.raw ?? {}) as Prisma.InputJsonValue },
    });
    if (!c.count) return "already_processed" as const;
    const e = await tx.tournamentEntry.findUniqueOrThrow({ where: { id: entry.id } });
    if (e.status !== "AWAITING_PAYMENT" && e.status !== "CANCELLED") return "already_processed" as const;
    const refund = async (why: string) => {
      await tx.tournamentEntry.update({ where: { id: e.id }, data: { status: "REFUND_NEEDED", paidAt: new Date(), note: why } });
      return "late_paid_needs_refund" as const;
    };
    if (!e.tournamentId) return refund("تورنومنت حذف شده است");
    await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${e.tournamentId} FOR UPDATE`;
    const t = await tx.tournament.findUnique({ where: { id: e.tournamentId }, select: { status: true, maxParticipants: true } });
    if (!t || t.status !== "REGISTRATION") return refund("ثبت‌نام تورنومنت بسته شده بود");
    const count = await tx.tournamentParticipant.count({ where: { tournamentId: e.tournamentId } });
    // This entry's own hold (if still valid) is part of takenPlaces, so compare against real participants.
    if (t.maxParticipants && count >= t.maxParticipants) return refund("ظرفیت تکمیل شده بود");
    const clash = await tx.tournamentParticipant.findFirst({ where: { tournamentId: e.tournamentId, OR: [{ userId: e.userId }, { name: e.name }] }, select: { userId: true } });
    if (clash) return refund(clash.userId === e.userId ? "کاربر از قبل در تورنومنت بود" : "نام انتخابی تکراری شده بود");
    const p = await tx.tournamentParticipant.create({ data: { tournamentId: e.tournamentId, userId: e.userId, name: e.name, seed: count + 1 }, select: { id: true } });
    await tx.tournamentEntry.update({ where: { id: e.id }, data: { status: "PAID", paidAt: new Date(), participantId: p.id, note: null } });
    return "paid" as const;
  });
  if (outcome === "paid") revalidateTag(CACHE_TAGS.tournaments, { expire: 0 });
  return outcome;
}

/** Unpaid registrations past their window stop holding a place. */
export async function expireStaleEntries(now = new Date()): Promise<number> {
  const { count } = await db.tournamentEntry.updateMany({ where: { status: "AWAITING_PAYMENT", paymentDeadline: { lt: now } }, data: { status: "CANCELLED", note: "مهلت پرداخت تمام شد" } });
  return count;
}

/** When a paid player leaves the tournament (removed by the organizer), their money must be returned. */
export async function markEntryForRefund(tx: Tx, participantId: string, why: string): Promise<void> {
  await tx.tournamentEntry.updateMany({ where: { participantId, status: "PAID" }, data: { status: "REFUND_NEEDED", note: why.slice(0, 300) } });
}
