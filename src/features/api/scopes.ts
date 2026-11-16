/** Permissions an API key can have (Admin → کلیدهای API). */
export const API_SCOPES = [
  { key: "booking:read", label: "دیدن شیفت‌ها، ظرفیت خالی و رزروها" },
  { key: "booking:write", label: "ثبت، لغو و تغییر وضعیت رزرو" },
  { key: "discount:read", label: "بررسی کد تخفیف" },
] as const;
export type ApiScope = (typeof API_SCOPES)[number]["key"];
export const API_SCOPE_KEYS = API_SCOPES.map((s) => s.key) as ApiScope[];

/** Requests per minute per key. */
export const API_RATE_PER_MINUTE = 120;

export const API_KEY_PREFIX = "atm_";
