import "server-only";
import { db } from "@/lib/db";
import type { EntitlementKey } from "./constants";
import { evaluateEntitlement, type EntitlementSubject } from "./entitlement-rules";

async function loadSubject(userId: string): Promise<EntitlementSubject | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isActive: true,
      partnerProfile: {
        select: {
          status: true,
          subscriptions: {
            where: { status: "ACTIVE" },
            select: { status: true, startsAt: true, endsAt: true, plan: { select: { features: true } } },
          },
        },
      },
    },
  });
  if (!user) return null;
  return {
    role: user.role,
    isActive: user.isActive,
    partner: user.partnerProfile
      ? { status: user.partnerProfile.status, subscriptions: user.partnerProfile.subscriptions.map((s) => ({ status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, features: s.plan.features })) }
      : null,
  };
}

/**
 * Single source of truth for gated features (e.g. Gamepad Tester). Always evaluated on the server
 * from the database — never trust a client-side flag.
 */
export async function hasEntitlement(userId: string | null | undefined, key: EntitlementKey): Promise<boolean> {
  if (!userId) return false;
  return evaluateEntitlement(await loadSubject(userId), key);
}
