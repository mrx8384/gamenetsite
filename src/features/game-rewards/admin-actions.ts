"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { parseIdentifier } from "@/lib/identifiers";
import { getRequestInfo } from "@/lib/request-info";
import { parseRules, REWARDS_SETTINGS_KEY, rewardCardSchema, rewardRulesSchema } from "./rules";
import { adjustPoints, cancelRedemption, REWARD_ERROR_TEXT, RewardError, acceptInStore } from "./service";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const DENIED = "دسترسی غیرمجاز.";
const rewardFail = (e: unknown) => {
  if (e instanceof RewardError) return fail(REWARD_ERROR_TEXT[e.code]);
  throw e;
};

export async function saveRewardRules(input: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail(DENIED);
  const parsed = rewardRulesSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const value = parseRules(parsed.data);
  await db.siteSetting.upsert({ where: { key: REWARDS_SETTINGS_KEY }, create: { key: REWARDS_SETTINGS_KEY, value }, update: { value } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "rewards.rules_updated", entity: "setting", entityId: REWARDS_SETTINGS_KEY, ip });
  updateTag(CACHE_TAGS.settings);
  revalidatePath("/admin/game-rewards");
  return ok(undefined, "قوانین امتیاز ذخیره شد.");
}

export async function saveRewardCard(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail(DENIED);
  const parsed = rewardCardSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const saved = id
    ? await db.rewardCard.update({ where: { id }, data: parsed.data, select: { id: true } }).catch(() => null)
    : await db.rewardCard.create({ data: parsed.data, select: { id: true } });
  if (!saved) return fail("کارت پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: id ? "rewards.card_updated" : "rewards.card_created", entity: "reward_card", entityId: saved.id, ip });
  revalidatePath("/admin/game-rewards/cards");
  return ok(saved, "کارت ذخیره شد.");
}

export async function deleteRewardCard(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail(DENIED);
  // cards already taken keep their own copy (title, percent, channel), so deleting is safe
  const { count } = await db.rewardCard.deleteMany({ where: { id: String(id) } });
  if (!count) return fail("کارت پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "rewards.card_deleted", entity: "reward_card", entityId: String(id), ip });
  revalidatePath("/admin/game-rewards/cards");
  return ok(undefined, "کارت حذف شد.");
}

const codeSchema = z.string().trim().min(4).max(40);

/** The counter accepts a card: marked as used (in-store). */
export async function acceptRewardCode(code: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail(DENIED);
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return fail("کد معتبر نیست.");
  try {
    const r = await acceptInStore(parsed.data, user.id);
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: "rewards.code_used", entity: "reward_redemption", entityId: r.code, ip });
  } catch (e) {
    return rewardFail(e);
  }
  revalidatePath("/admin/game-rewards/codes");
  return ok(undefined, "کارت ثبت شد و دیگر قابل استفاده نیست.");
}

export async function cancelRewardCode(code: unknown, refund: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail(DENIED);
  const parsed = codeSchema.safeParse(code);
  if (!parsed.success) return fail("کد معتبر نیست.");
  try {
    const r = await cancelRedemption(parsed.data, user.id, refund === true);
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: "rewards.code_cancelled", entity: "reward_redemption", entityId: r.code, meta: { refund: refund === true }, ip });
  } catch (e) {
    return rewardFail(e);
  }
  revalidatePath("/admin/game-rewards/codes");
  return ok(undefined, refund === true ? "کارت لغو شد و امتیازش برگشت." : "کارت لغو شد.");
}

const adjustSchema = z.object({
  identifier: z.string().trim().min(3, "موبایل یا ایمیل کاربر را وارد کنید").max(254),
  amount: z.coerce.number().int().min(-100_000).max(100_000).refine((v) => v !== 0, "مقدار نباید صفر باشد"),
  note: z.string().trim().min(2, "دلیل را بنویسید").max(200),
});

/** Manual correction of a user's points (with a reason, in the audit log). */
export async function adjustUserPoints(input: unknown): Promise<ActionResult<{ balance: number }>> {
  const user = await admin();
  if (!user) return fail(DENIED);
  const parsed = adjustSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier);
  if (!id) return fail("موبایل یا ایمیل معتبر نیست.", { identifier: "موبایل یا ایمیل معتبر نیست." });
  const target = await db.user.findFirst({ where: id.kind === "phone" ? { phone: id.value } : { email: id.value }, select: { id: true } });
  if (!target) return fail("کاربری با این مشخصات پیدا نشد.", { identifier: "کاربری پیدا نشد." });
  try {
    const balance = await adjustPoints(target.id, parsed.data.amount, parsed.data.note, user.id);
    const { ip } = await getRequestInfo();
    await audit({ actorId: user.id, action: "rewards.points_adjusted", entity: "user", entityId: target.id, meta: { amount: parsed.data.amount, note: parsed.data.note }, ip });
    revalidatePath("/admin/game-rewards/codes");
    return ok({ balance }, "امتیاز کاربر به‌روز شد.");
  } catch (e) {
    return rewardFail(e);
  }
}
