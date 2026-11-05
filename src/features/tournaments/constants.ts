/** Shared labels and rules for tournaments (client + server). */
export const TOURNAMENT_FORMATS = ["SINGLE_ELIMINATION", "DOUBLE_ELIMINATION", "ROUND_ROBIN", "GROUPS_KNOCKOUT", "SWISS", "LEADERBOARD"] as const;
export type TournamentFormatKey = (typeof TOURNAMENT_FORMATS)[number];

export const FORMAT_LABELS: Record<TournamentFormatKey, string> = {
  SINGLE_ELIMINATION: "حذفی یک‌باخت",
  DOUBLE_ELIMINATION: "حذفی دوباخت",
  ROUND_ROBIN: "لیگی (همه با همه)",
  GROUPS_KNOCKOUT: "گروهی + حذفی",
  SWISS: "سوئیسی",
  LEADERBOARD: "جدول امتیاز (بتل رویال / مسابقه‌ای)",
};

export const FORMAT_HINTS: Record<TournamentFormatKey, string> = {
  SINGLE_ELIMINATION: "بازنده حذف می‌شود؛ امکان بازی رده‌بندی.",
  DOUBLE_ELIMINATION: "هر بازیکن با دو باخت حذف می‌شود (جدول بالا و پایین + فینال).",
  ROUND_ROBIN: "همه با هم بازی می‌کنند؛ رتبه با جدول امتیازات.",
  GROUPS_KNOCKOUT: "مرحلهٔ گروهی، سپس صعودکنندگان به مرحلهٔ حذفی می‌روند.",
  SWISS: "چند دور؛ در هر دور بازیکنان هم‌امتیاز با هم بازی می‌کنند (بدون بازی تکراری). مناسب تعداد زیاد.",
  LEADERBOARD: "بدون جدول بازی؛ در هر دور/مسابقه به هر نفر امتیاز می‌دهید و جمع امتیازها رتبه را تعیین می‌کند.",
};

export const GRAND_FINAL_MODES = ["reset", "single", "none"] as const;
export const GRAND_FINAL_LABELS: Record<(typeof GRAND_FINAL_MODES)[number], string> = {
  reset: "فینال بزرگ + بازی دوم اگر نفر جدول بازندگان برد (استاندارد)",
  single: "فقط یک بازی فینال بزرگ",
  none: "بدون فینال بزرگ (قهرمان جدول اصلی قهرمان است)",
};

export const TIEBREAKS = ["goal_difference", "head_to_head"] as const;
export const TIEBREAK_LABELS: Record<(typeof TIEBREAKS)[number], string> = {
  goal_difference: "بعد از امتیاز: تفاضل گل، گل زده، نتیجهٔ رو در رو",
  head_to_head: "بعد از امتیاز: نتیجهٔ رو در رو، تفاضل گل، گل زده",
};

export type TournamentStatusKey = "DRAFT" | "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const STATUS_LABELS: Record<TournamentStatusKey, string> = {
  DRAFT: "پیش‌نویس",
  REGISTRATION: "ثبت‌نام باز",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "پایان‌یافته",
  CANCELLED: "لغوشده",
};

export const STATUS_BADGE: Record<TournamentStatusKey, "outline" | "success" | "warning" | "secondary" | "destructive"> = {
  DRAFT: "outline",
  REGISTRATION: "success",
  IN_PROGRESS: "warning",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
};

export const ELIMINATION_STAGES = ["WINNERS", "LOSERS", "GRAND_FINAL", "GRAND_FINAL_RESET", "THIRD_PLACE"] as const;
export const isEliminationStage = (stage: string) => (ELIMINATION_STAGES as readonly string[]).includes(stage);

export const STAGE_LABELS: Record<string, string> = {
  WINNERS: "جدول اصلی",
  LOSERS: "جدول بازندگان",
  GRAND_FINAL: "فینال بزرگ",
  GRAND_FINAL_RESET: "فینال بزرگ (بازی دوم)",
  THIRD_PLACE: "رده‌بندی",
  ROUND_ROBIN: "لیگ",
  GROUP: "مرحلهٔ گروهی",
  SWISS: "سوئیسی",
};

export const MAX_PARTICIPANTS = 256;
export const RESERVED_SLUGS = new Set(["gamepad-tester", "new"]);

export const groupName = (i: number) => `گروه ${"ABCDEFGHIJKLMNOP"[i] ?? i + 1}`;

/** The check-in window: from `minutes` before the start until the organizer starts the tournament. Pure. */
export function checkInOpen(startsAt: Date, minutes: number, now = new Date()): boolean {
  return now.getTime() >= startsAt.getTime() - minutes * 60_000;
}
