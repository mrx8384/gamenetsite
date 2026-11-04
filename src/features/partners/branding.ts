import "server-only";
import { db } from "@/lib/db";
import { mediaUrl } from "@/lib/media";
import { isSubscriptionCurrent } from "@/features/subscriptions/entitlement-rules";

export interface PartnerBranding {
  businessName: string;
  /** Approved logo, or null (the partner's name is shown instead). */
  logoUrl: string | null;
}

/**
 * The partner's own look for their area (/partner/…): an approved partner with a current subscription
 * sees their name/logo there and no Atom logo. Everyone else gets the normal site look (null).
 */
export async function getPartnerBranding(userId: string, now = new Date()): Promise<PartnerBranding | null> {
  const p = await db.partnerProfile.findUnique({
    where: { userId },
    select: {
      status: true,
      businessName: true,
      logo: { select: { storageKey: true } },
      user: { select: { role: true, isActive: true } },
      subscriptions: { where: { status: "ACTIVE" }, select: { status: true, startsAt: true, endsAt: true } },
    },
  });
  if (!p || p.status !== "APPROVED" || p.user.role !== "PARTNER" || !p.user.isActive) return null;
  if (!p.subscriptions.some((s) => isSubscriptionCurrent({ ...s, features: [] }, now))) return null;
  return { businessName: p.businessName, logoUrl: p.logo ? mediaUrl(p.logo.storageKey) : null };
}
