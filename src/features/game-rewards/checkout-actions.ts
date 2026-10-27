"use server";

import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { codeState, normalizeCode, usableOnline } from "./rules";

/** Checkout: is this discount card usable for the logged-in user's online order? (checked again when ordering) */
export async function checkRewardCode(input: unknown): Promise<ActionResult<{ code: string; title: string; discountPercent: number }>> {
  let userId: string;
  try {
    userId = (await assertUser()).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("برای ادامه وارد حساب کاربری شوید.");
    throw e;
  }
  if (typeof input !== "string" || input.trim().length < 4 || input.length > 40) return fail("کد را درست وارد کنید (مثل ATOM-AB12-CD34).");
  if (!(await rateLimit(`reward-check:${userId}`, 20, 10 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const r = await db.rewardRedemption.findUnique({ where: { code: normalizeCode(input) } });
  if (!r || r.userId !== userId) return fail("این کد در حساب شما پیدا نشد.");
  const state = codeState(r);
  if (state !== "ACTIVE") return fail(state === "USED" ? "این کارت قبلاً استفاده شده است." : state === "EXPIRED" ? "اعتبار این کارت تمام شده است." : "این کارت لغو شده است.");
  if (!usableOnline(r.channel)) return fail("این کارت فقط حضوری در گیم‌نت اتم قابل استفاده است.");
  return ok({ code: r.code, title: r.title, discountPercent: r.discountPercent });
}
