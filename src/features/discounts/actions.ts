"use server";

import { z } from "zod";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { codeState, normalizeCode, orderDiscount, usableOnline } from "@/features/game-rewards/rules";
import { DiscountError, previewDiscount } from "./service";
import { capForGateway, DISCOUNT_SCOPES } from "./rules";

const checkSchema = z.object({
  code: z.string().trim().min(3).max(40),
  scope: z.enum(DISCOUNT_SCOPES),
  /** Rials, from the form; only for the preview — the purchase recomputes everything on the server. */
  amount: z.string().regex(/^\d{1,15}$/),
});

export type CodePreview = { type: "reward" | "discount"; code: string; title: string; discount: string };

/**
 * Preview of a code in a purchase form. In the shop the same box also takes the 3D world's discount cards.
 */
export async function checkDiscountCode(input: unknown): Promise<ActionResult<CodePreview>> {
  let userId: string;
  try {
    userId = (await assertUser()).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("برای ادامه وارد حساب کاربری شوید.");
    throw e;
  }
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return fail("کد را درست وارد کنید.");
  if (!(await rateLimit(`discount-check:${userId}`, 20, 10 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const amount = BigInt(parsed.data.amount);

  if (parsed.data.scope === "SHOP") {
    const card = await db.rewardRedemption.findUnique({ where: { code: normalizeCode(parsed.data.code) } });
    if (card && card.userId === userId) {
      const state = codeState(card);
      if (state !== "ACTIVE") return fail(state === "USED" ? "این کارت قبلاً استفاده شده است." : state === "EXPIRED" ? "اعتبار این کارت تمام شده است." : "این کارت لغو شده است.");
      if (!usableOnline(card.channel)) return fail("این کارت فقط حضوری در گیم‌نت اتم قابل استفاده است.");
      return ok({ type: "reward", code: card.code, title: `${card.title} (${card.discountPercent.toLocaleString("fa-IR")}٪)`, discount: orderDiscount(amount, card.discountPercent).toString() });
    }
  }
  try {
    const d = await previewDiscount({ code: parsed.data.code, scope: parsed.data.scope, amount, userId });
    const discount = parsed.data.scope === "BOOKING" ? d.discount : capForGateway(amount, d.discount);
    return ok({ type: "discount", code: d.code, title: d.title || d.code, discount: discount.toString() });
  } catch (e) {
    if (e instanceof DiscountError) return fail(e.message);
    throw e;
  }
}
