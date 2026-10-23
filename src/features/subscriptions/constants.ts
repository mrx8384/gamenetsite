/**
 * Subscription purchasing is OFF by owner instruction. Flip only when the owner approves paid
 * subscriptions AND a real payment provider is configured. Nothing else in the code enables buying.
 */
export const SUBSCRIPTION_PURCHASE_ENABLED = false as const;

/** Entitlement keys a plan can grant. Gated features check these through `hasEntitlement`. */
export const ENTITLEMENTS = {
  GAMEPAD_TESTER: "تست دسته (Gamepad Tester)",
  TOURNAMENT_HOST: "برگزاری تورنومنت",
} as const;
export type EntitlementKey = keyof typeof ENTITLEMENTS;
export const ENTITLEMENT_KEYS = Object.keys(ENTITLEMENTS) as EntitlementKey[];


export const SUBSCRIPTION_PHASE_LABELS = {
  current: "فعال",
  scheduled: "شروع در آینده",
  expired: "منقضی",
  cancelled: "لغوشده",
  inactive: "غیرفعال",
} as const;
