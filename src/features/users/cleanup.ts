import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";

/** Site setting key for «حذف خودکار حساب‌های بدون فعالیت» (Admin → کاربران). */
export const ACCOUNTS_SETTINGS_KEY = "accounts";
export const INACTIVE_MONTH_OPTIONS = [0, 6, 12, 24, 36] as const;

export const accountsSettingsSchema = z.object({
  /** 0 = off. Otherwise accounts with no activity for this many months are deleted by the daily maintenance. */
  inactiveDeleteMonths: z.coerce
    .number()
    .int()
    .refine((n) => (INACTIVE_MONTH_OPTIONS as readonly number[]).includes(n), "مقدار نامعتبر است")
    .default(0),
});
export type AccountsSettings = z.infer<typeof accountsSettingsSchema>;

export function inactiveCutoff(months: number, now = new Date()): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/**
 * Accounts that may be removed automatically: ordinary users only (never admins, support staff or partners),
 * without orders or a partner profile, created before the cutoff, with no login and no session use since.
 */
export function inactiveUsersWhere(cutoff: Date): Prisma.UserWhereInput {
  return {
    role: "USER",
    createdAt: { lt: cutoff },
    OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: cutoff } }],
    sessions: { none: { lastSeenAt: { gte: cutoff } } },
    orders: { none: {} },
    partnerProfile: { is: null },
  };
}

/**
 * Why an admin can't delete this account (null = allowed). Orders and paid subscriptions are kept for sales
 * records. A partner file (application, free subscriptions) is removed with the account; tournaments it
 * organized stay and are managed by admins.
 */
export function deletionBlocker(u: { role: string; orderCount: number; paidSubscriptionCount?: number }): string | null {
  if (u.role === "ADMIN") return "حساب مدیر را نمی‌شود حذف کرد؛ اول نقش او را تغییر دهید.";
  if (u.orderCount > 0) return "این کاربر سفارش ثبت کرده و برای حفظ سوابق فروش حذف نمی‌شود؛ می‌توانید حسابش را غیرفعال کنید.";
  if ((u.paidSubscriptionCount ?? 0) > 0) return "این همکار اشتراک پولی خریده و برای حفظ سوابق فروش حذف نمی‌شود؛ می‌توانید حسابش را غیرفعال کنید.";
  return null;
}
