import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { applyPaymentResult } from "@/features/orders/service";
import { applySubscriptionPayment, SUBSCRIPTION_PAYMENT_MINUTES } from "@/features/subscriptions/purchase";
import { applyEntryPayment } from "@/features/tournaments/entries";
import { getPaymentProvider } from "./index";

/**
 * One payment pays for exactly one thing: a store order, a partner subscription or a tournament entry.
 * Gateways (callback route, Bale bot) only talk to this module, so every kind gets the same verified flow.
 */
export type PaymentKind = "order" | "subscription" | "tournament";

export type GatewayResult = { ok: true; referenceId: string; cardPanMasked?: string; raw?: unknown } | { ok: false; reason: string; raw?: unknown };
export type GatewayOutcome = "paid" | "failed" | "already_processed" | "late_paid_needs_refund";

export interface PaymentTarget {
  paymentId: string;
  provider: string;
  status: "INITIATED" | "SUCCEEDED" | "FAILED" | "CANCELLED";
  amount: bigint;
  raw: unknown;
  kind: PaymentKind;
  /** Owner of the payment (only they may see its page). */
  userId: string;
  /** Short Persian label, e.g. «سفارش ATM-123456» or «اشتراک طلایی». */
  title: string;
  /** Still payable now (not expired, not cancelled). */
  open: boolean;
  /** Where the customer goes after paying. */
  returnPath: string;
  /** Paid, but what it was for could not be delivered (money must be returned). */
  needsRefund: boolean;
}

const select = {
  id: true,
  provider: true,
  status: true,
  amount: true,
  raw: true,
  createdAt: true,
  order: { select: { number: true, userId: true, status: true, paymentDeadline: true } },
  subscription: { select: { status: true, plan: { select: { name: true } }, partner: { select: { userId: true } } } },
  tournamentEntry: { select: { status: true, paymentDeadline: true, tournamentName: true, userId: true, tournament: { select: { slug: true } } } },
} satisfies Prisma.PaymentSelect;

type Row = Prisma.PaymentGetPayload<{ select: typeof select }>;

function toTarget(p: Row, now: Date): PaymentTarget | null {
  const base = { paymentId: p.id, provider: p.provider, status: p.status, amount: p.amount, raw: p.raw };
  if (p.order) {
    return {
      ...base,
      kind: "order",
      userId: p.order.userId,
      title: `سفارش ${p.order.number}`,
      open: p.order.status === "AWAITING_PAYMENT" && (!p.order.paymentDeadline || p.order.paymentDeadline > now),
      returnPath: `/account/orders/${encodeURIComponent(p.order.number)}`,
      needsRefund: p.status === "SUCCEEDED" && p.order.status === "CANCELLED",
    };
  }
  if (p.subscription) {
    const deadline = new Date(p.createdAt.getTime() + SUBSCRIPTION_PAYMENT_MINUTES * 60_000);
    return {
      ...base,
      kind: "subscription",
      userId: p.subscription.partner.userId,
      title: `اشتراک ${p.subscription.plan.name}`,
      open: p.subscription.status === "INACTIVE" && deadline > now,
      returnPath: "/partner",
      needsRefund: false,
    };
  }
  if (p.tournamentEntry) {
    const e = p.tournamentEntry;
    return {
      ...base,
      kind: "tournament",
      userId: e.userId,
      title: `ثبت‌نام تورنومنت ${e.tournamentName}`,
      open: e.status === "AWAITING_PAYMENT" && e.paymentDeadline > now,
      returnPath: e.tournament ? `/tournaments/${encodeURIComponent(e.tournament.slug)}` : "/tournaments",
      needsRefund: e.status === "REFUND_NEEDED" || e.status === "REFUNDED",
    };
  }
  return null;
}

export async function findPaymentTarget(where: Prisma.PaymentWhereUniqueInput, now = new Date()): Promise<PaymentTarget | null> {
  const p = await db.payment.findUnique({ where, select });
  return p ? toTarget(p, now) : null;
}

/** Applies a verified gateway result to whatever the payment was for. Idempotent. */
export async function applyGatewayResult(paymentId: string, result: GatewayResult): Promise<{ result: GatewayOutcome; target: PaymentTarget | null }> {
  const target = await findPaymentTarget({ id: paymentId });
  if (!target) throw new Error("payment_without_target");
  let outcome: GatewayOutcome;
  if (target.kind === "order") outcome = (await applyPaymentResult(paymentId, result)).result;
  else if (target.kind === "subscription") outcome = await applySubscriptionPayment(paymentId, result);
  else outcome = await applyEntryPayment(paymentId, result);
  return { result: outcome, target };
}

/**
 * Registers an already-created Payment row with the active gateway and stores its authority.
 * Returns the URL to send the customer to.
 */
export async function openGatewayPayment(paymentId: string, input: { amount: bigint; description: string; mobile: string | null }): Promise<string> {
  const provider = getPaymentProvider();
  if (!provider) throw new Error("no_provider");
  const callbackUrl = new URL(`/api/payments/callback/${provider.key}`, env.APP_URL).toString();
  const { authority, redirectUrl } = await provider.createPayment({ paymentId, amount: input.amount, description: input.description, callbackUrl, mobile: input.mobile });
  await db.payment.update({ where: { id: paymentId }, data: { authority } });
  return redirectUrl;
}

/** `?payment=` value for the return page of a payment that went through. */
export const paidResult = (t: PaymentTarget) => (t.needsRefund ? "late_paid_needs_refund" : "paid");

/** Test credentials move no money: only admins may pay while they are in use. */
export function paymentBlockedForTestMode(role: string): boolean {
  return getPaymentProvider()?.testMode === true && role !== "ADMIN";
}

export const TEST_MODE_ERROR = "درگاه پرداخت در حالت آزمایشی است و فعلاً فقط مدیر سایت می‌تواند پرداخت کند.";
