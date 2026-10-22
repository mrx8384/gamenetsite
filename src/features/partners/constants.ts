/** Labels and rules shared by the partner forms (client) and server actions. */
export const BUSINESS_TYPES = ["GAME_NET", "STORE", "ESPORTS_TEAM", "OTHER"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  GAME_NET: "گیم‌نت",
  STORE: "فروشگاه",
  ESPORTS_TEAM: "تیم ای‌اسپورت",
  OTHER: "سایر",
};

export type PartnerStatusKey = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export const PARTNER_STATUS_LABELS: Record<PartnerStatusKey, string> = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
  SUSPENDED: "تعلیق‌شده",
};

export const PARTNER_STATUS_BADGE: Record<PartnerStatusKey, "warning" | "success" | "destructive" | "outline"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  SUSPENDED: "outline",
};
