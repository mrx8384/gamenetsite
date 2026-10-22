import "server-only";
import { db } from "@/lib/db";
import { SUBSCRIPTION_PURCHASE_ENABLED } from "@/features/subscriptions/constants";
import { isSubscriptionCurrent } from "@/features/subscriptions/entitlement-rules";

export async function getMyPartnerProfile(userId: string) {
  return db.partnerProfile.findUnique({
    where: { userId },
    include: {
      subscriptions: { orderBy: { createdAt: "desc" }, take: 10, include: { plan: { select: { name: true, features: true } } } },
    },
  });
}

export type MyPartnerProfile = NonNullable<Awaited<ReturnType<typeof getMyPartnerProfile>>>;

export function currentSubscription(profile: MyPartnerProfile, now = new Date()) {
  return profile.subscriptions.find((s) => isSubscriptionCurrent({ status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, features: s.plan.features }, now)) ?? null;
}

/** Plans shown to visitors/partners. Prices are display-only while purchasing is disabled. */
export async function getVisiblePlans() {
  const plans = await db.subscriptionPlan.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, description: true, price: true, durationDays: true, features: true, isActive: true },
  });
  return plans.map((p) => ({ ...p, price: p.price.toString(), purchasable: SUBSCRIPTION_PURCHASE_ENABLED && p.isActive }));
}

export type VisiblePlan = Awaited<ReturnType<typeof getVisiblePlans>>[number];
