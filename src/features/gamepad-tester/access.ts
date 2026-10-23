import "server-only";
import { db } from "@/lib/db";
import { hasEntitlement } from "@/features/subscriptions/entitlements";

/** The browser-based tester is live (owner request 2026-10-23). Set to false to show "coming soon" again. */
export const GAMEPAD_TESTER_ENABLED = true as const;

/** Who may use the tester: entitled partners, and admins (the owner tests controllers too). */
export function canUseGamepadTester(access: GamepadAccess): boolean {
  return GAMEPAD_TESTER_ENABLED && (access === "granted" || access === "admin");
}

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
