"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { getPaymentProvider } from "@/features/payments";
import { openGatewayPayment, paymentBlockedForTestMode, TEST_MODE_ERROR } from "@/features/payments/targets";
import { SUBSCRIPTION_PURCHASE_ENABLED } from "./constants";
import { expireStaleSubscriptionPurchases } from "./purchase";

/** An approved partner buys a plan online. Free (0 Toman) plans are activated by the payment flow too, so they are not offered here. */
export async function buySubscription(planId: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  let s;
  try {
    s = await assertUser();
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("برای خرید اشتراک وارد حساب کاربری شوید.");
    throw e;
  }
  const user = s.user;
  if (typeof planId !== "string" || !planId) return fail("اشتراک پیدا نشد.");
  if (!SUBSCRIPTION_PURCHASE_ENABLED || !getPaymentProvider()) return fail("خرید آنلاین اشتراک در حال حاضر فعال نیست.");
  if (paymentBlockedForTestMode(user.role)) return fail(TEST_MODE_ERROR);
  if (!(await rateLimit(`subscription-buy:${user.id}`, 10, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const partner = await db.partnerProfile.findUnique({ where: { userId: user.id }, select: { id: true, status: true, businessName: true } });
  if (!partner || partner.status !== "APPROVED") return fail("خرید اشتراک فقط برای همکاران تأییدشده ممکن است.");
  const plan = await db.subscriptionPlan.findUnique({ where: { id: planId }, select: { id: true, name: true, price: true, isActive: true, isVisible: true } });
  if (!plan || !plan.isActive || !plan.isVisible) return fail("این اشتراک برای خرید فعال نیست.");
  if (plan.price <= BigInt(0)) return fail("این اشتراک رایگان است و توسط مدیر سایت فعال می‌شود.");

  await expireStaleSubscriptionPurchases();
  // One open purchase at a time: an earlier unpaid attempt is replaced.
  await db.partnerSubscription.updateMany({ where: { partnerId: partner.id, status: "INACTIVE", payment: { status: "INITIATED" } }, data: { status: "CANCELLED", note: "جایگزین با خرید جدید" } });

  const provider = getPaymentProvider()!;
  const payment = await db.payment.create({ data: { provider: provider.key, amount: plan.price }, select: { id: true } });
  const sub = await db.partnerSubscription.create({ data: { partnerId: partner.id, planId: plan.id, status: "INACTIVE", paymentId: payment.id, note: "در انتظار پرداخت" }, select: { id: true } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "subscriptions.purchase_started", entity: "partner", entityId: partner.id, ip, meta: { subscriptionId: sub.id, plan: plan.name, amount: plan.price.toString() } });
  try {
    const redirectTo = await openGatewayPayment(payment.id, { amount: plan.price, description: `اشتراک ${plan.name} — ${partner.businessName}`, mobile: user.phone });
    return ok({ redirectTo });
  } catch (e) {
    console.error("[subscriptions] payment start failed", e);
    await db.$transaction([
      db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } }),
      db.partnerSubscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", note: "خطا در اتصال به درگاه" } }),
    ]);
    return fail("اتصال به درگاه پرداخت ناموفق بود؛ لطفاً دوباره تلاش کنید.");
  }
}
