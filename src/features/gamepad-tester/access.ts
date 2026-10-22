import "server-only";
import { db } from "@/lib/db";
import { hasEntitlement } from "@/features/subscriptions/entitlements";

/**
 * The tester itself is NOT implemented (waiting for detailed specs). Keep this false until then;
 * even entitled partners only see a "coming soon" panel.
 */
export const GAMEPAD_TESTER_ENABLED = false as const;

export type GamepadAccess = "anonymous" | "admin" | "no-application" | "pending" | "rejected" | "suspended" | "no-subscription" | "granted";

/** Server-side access state for /tournaments/gamepad-tester. The only gate is `hasEntitlement`. */
export async function getGamepadAccess(user: { id: string; role: string } | null): Promise<GamepadAccess> {
  if (!user) return "anonymous";
  if (await hasEntitlement(user.id, "GAMEPAD_TESTER")) return "granted";
  if (user.role === "ADMIN") return "admin";
  const profile = await db.partnerProfile.findUnique({ where: { userId: user.id }, select: { status: true } });
  if (!profile) return "no-application";
  if (profile.status === "PENDING") return "pending";
  if (profile.status === "REJECTED") return "rejected";
  if (profile.status === "SUSPENDED") return "suspended";
  return "no-subscription";
}
