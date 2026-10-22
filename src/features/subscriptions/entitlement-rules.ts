import type { EntitlementKey } from "./constants";

export interface SubscriptionPeriod {
  status: "INACTIVE" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  startsAt: Date | null;
  endsAt: Date | null;
  features: string[];
}

export interface EntitlementSubject {
  role: "ADMIN" | "USER" | "PARTNER";
  isActive: boolean;
  partner: { status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED"; subscriptions: SubscriptionPeriod[] } | null;
}

/** A subscription counts only if marked ACTIVE and the current time is inside its period. */
export function isSubscriptionCurrent(s: SubscriptionPeriod, now: Date): boolean {
  return s.status === "ACTIVE" && s.startsAt !== null && s.endsAt !== null && s.startsAt <= now && now < s.endsAt;
}

/**
 * Pure rule (unit-tested): approved, active PARTNER account with a current subscription whose
 * plan includes the feature. Admins do not get partner features implicitly.
 */
export function evaluateEntitlement(subject: EntitlementSubject | null, key: EntitlementKey, now: Date = new Date()): boolean {
  if (!subject || !subject.isActive || subject.role !== "PARTNER") return false;
  const p = subject.partner;
  if (!p || p.status !== "APPROVED") return false;
  return p.subscriptions.some((s) => isSubscriptionCurrent(s, now) && s.features.includes(key));
}

export type SubscriptionPhase = "current" | "scheduled" | "expired" | "cancelled" | "inactive";

/** Display state derived from status + dates (an ACTIVE row past its end date is "expired"). */
export function subscriptionPhase(s: Omit<SubscriptionPeriod, "features">, now: Date = new Date()): SubscriptionPhase {
  if (s.status === "CANCELLED") return "cancelled";
  if (s.status === "EXPIRED") return "expired";
  if (s.status !== "ACTIVE" || !s.startsAt || !s.endsAt) return "inactive";
  if (now < s.startsAt) return "scheduled";
  if (now >= s.endsAt) return "expired";
  return "current";
}

/**
 * Start of a new manual grant: right after the latest ACTIVE period that has not ended yet
 * (so a renewal queues behind the current one), otherwise now.
 */
export function nextGrantStart(existing: Omit<SubscriptionPeriod, "features">[], now: Date = new Date()): Date {
  let start = now;
  for (const s of existing) {
    if (s.status === "ACTIVE" && s.endsAt && s.endsAt > start) start = s.endsAt;
  }
  return start;
}
