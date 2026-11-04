/**
 * Online subscription purchase (owner request 2026-11-04, after connecting the Bale wallet gateway).
 * A plan is buyable only when the admin marks it «قابل خرید آنلاین» (`isActive`) and a gateway is configured.
 */
export const SUBSCRIPTION_PURCHASE_ENABLED = true as boolean;

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
