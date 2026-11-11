import "server-only";
import { db } from "@/lib/db";
import { gamenetConfigured, getGamenetLicense, updateGamenetLicense } from "./client";
import { licenseTerm } from "./rules";

/** Loads what the license needs from the site's own data (the site is the source of truth). */
export async function loadPartnerTerm(partnerId: string, now = new Date()) {
  const partner = await db.partnerProfile.findUnique({
    where: { id: partnerId },
    select: {
      id: true,
      status: true,
      businessName: true,
      phone: true,
      user: { select: { name: true } },
      subscriptions: { where: { status: { in: ["ACTIVE", "EXPIRED"] } }, select: { status: true, startsAt: true, endsAt: true, plan: { select: { features: true } } } },
    },
  });
  if (!partner) return null;
  const term = licenseTerm(partner.subscriptions.map((s) => ({ status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, features: s.plan.features })), now);
  return { partner, term };
}

/**
 * Pushes the partner's current subscription end, remote access and status to their software account
 * (if they have one). Called after a purchase, a manual grant/cancel and a partner status change, and
 * daily from maintenance as a safety net. Never throws: a failure is logged and retried later.
 */
export async function syncGamenetLicense(partnerId: string): Promise<"updated" | "no_account" | "skipped" | "failed"> {
  if (!gamenetConfigured()) return "skipped";
  try {
    const now = new Date();
    const loaded = await loadPartnerTerm(partnerId, now);
    if (!loaded) return "skipped";
    const existing = await getGamenetLicense(partnerId);
    if (!existing) return "no_account";
    const { partner, term } = loaded;
    await updateGamenetLicense(partnerId, {
      endsAt: term.endsAt ?? now,
      remote: term.remote,
      status: partner.status === "APPROVED" ? "active" : "suspended",
      businessName: partner.businessName,
      phoneNumber: partner.phone,
    });
    return "updated";
  } catch (e) {
    console.error("[gamenet-license] sync failed", partnerId, e);
    return "failed";
  }
}

/** Fire-and-forget variant for request handlers: the response is not delayed by the license server. */
export function syncGamenetLicenseLater(partnerId: string): void {
  void syncGamenetLicense(partnerId);
}
