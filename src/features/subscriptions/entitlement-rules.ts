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
