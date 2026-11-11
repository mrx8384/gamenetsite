import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";

/**
 * Account rules for «نرم‌افزار مدیریت گیم‌نت». The license server enforces the same rules;
 * these give the partner immediate feedback in the form.
 */
export const USERNAME_HINT = "۴ تا ۳۰ کاراکتر، با حرف انگلیسی شروع شود؛ فقط حروف انگلیسی، عدد و _ . -";
export const PASSWORD_HINTS = ["حداقل ۸ کاراکتر", "حداقل یک حرف بزرگ انگلیسی (A-Z)", "حداقل یک حرف کوچک انگلیسی (a-z)", "حداقل یک عدد", "بدون فاصله"] as const;

export const usernameSchema = z
  .string()
  .transform((v) => toEnglishDigits(v.trim()))
  .pipe(z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{3,29}$/, `نام کاربری: ${USERNAME_HINT}`));

export const passwordSchema = z
  .string()
  .transform((v) => toEnglishDigits(v))
  .pipe(
    z
      .string()
      .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
      .max(64, "رمز عبور حداکثر ۶۴ کاراکتر است.")
      .regex(/^\S+$/, "رمز عبور نباید فاصله داشته باشد.")
      .regex(/[A-Z]/, "رمز عبور باید حداقل یک حرف بزرگ انگلیسی (A-Z) داشته باشد.")
      .regex(/[a-z]/, "رمز عبور باید حداقل یک حرف کوچک انگلیسی (a-z) داشته باشد.")
      .regex(/[0-9]/, "رمز عبور باید حداقل یک عدد داشته باشد."),
  );

export const createAccountSchema = z
  .object({ username: usernameSchema, password: passwordSchema, confirm: z.string() })
  .refine((v) => toEnglishDigits(v.confirm) === v.password, { message: "تکرار رمز عبور یکی نیست.", path: ["confirm"] });

export const changePasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => toEnglishDigits(v.confirm) === v.password, { message: "تکرار رمز عبور یکی نیست.", path: ["confirm"] });

export interface TermSubscription {
  status: "INACTIVE" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  startsAt: Date | null;
  endsAt: Date | null;
  features: string[];
}

/**
 * Pure rule (unit-tested): what the software license should look like for a partner.
 * - endsAt: end of the last ACTIVE/EXPIRED period whose plan includes GAMENET_APP (renewals queue
 *   back to back, so the latest end covers the whole paid time). Cancelled periods do not count.
 * - entitled: such a period has not ended yet (current or scheduled) — needed to create the account.
 * - remote: a not-yet-ended period also includes GAMENET_REMOTE.
 */
export function licenseTerm(subs: TermSubscription[], now: Date = new Date()): { endsAt: Date | null; entitled: boolean; remote: boolean } {
  let endsAt: Date | null = null;
  let entitled = false;
  let remote = false;
  for (const s of subs) {
    if ((s.status !== "ACTIVE" && s.status !== "EXPIRED") || !s.endsAt || !s.features.includes("GAMENET_APP")) continue;
    if (!endsAt || s.endsAt > endsAt) endsAt = s.endsAt;
    if (s.status === "ACTIVE" && s.endsAt > now) {
      entitled = true;
      if (s.features.includes("GAMENET_REMOTE")) remote = true;
    }
  }
  return { endsAt, entitled, remote };
}
