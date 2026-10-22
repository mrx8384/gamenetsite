"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { revokeUserSessions } from "@/lib/auth/session";
import { fail, GENERIC_ERROR, isUniqueViolation, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { maskIdentifier, parseIdentifier } from "@/lib/identifiers";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { toPersianDigits } from "@/lib/format";
import { changePasswordSchema, contactChangeSchema, contactConfirmSchema, profileSchema } from "@/features/auth/schemas";
import { issueCode, RESEND_COOLDOWN_SECONDS, verifyCode } from "@/features/auth/verification";

const LOGIN_REQUIRED = "برای ادامه وارد حساب کاربری شوید.";

async function session() {
  try {
    return await assertUser();
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

export async function updateProfile(input: unknown): Promise<ActionResult<undefined>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", zodFieldErrors(parsed.error.issues));
  await db.user.update({ where: { id: s.user.id }, data: { name: parsed.data.name } });
  revalidatePath("/account");
  return ok(undefined, "اطلاعات حساب ذخیره شد.");
}

export async function changePassword(input: unknown): Promise<ActionResult<undefined>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { ip } = await getRequestInfo();
  if (!(await rateLimit(`pwchange:${s.user.id}`, 5, 15 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const user = await db.user.findUniqueOrThrow({ where: { id: s.user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    return fail("رمز عبور فعلی اشتباه است.", { currentPassword: "رمز عبور فعلی اشتباه است." });
  }
  await db.user.update({
    where: { id: s.user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword), sessionVersion: { increment: 1 } },
  });
  const revoked = await revokeUserSessions(s.user.id, s.sessionId); // keep this device signed in
  await audit({ actorId: s.user.id, action: "account.password_changed", entity: "user", entityId: s.user.id, ip, meta: { revoked } });
  revalidatePath("/account/security");
  return ok(undefined, "رمز عبور تغییر کرد. سایر دستگاه‌ها از حساب خارج شدند.");
}

export async function requestContactChange(input: unknown): Promise<ActionResult<{ masked: string; cooldownSeconds: number }>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const parsed = contactChangeSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  if (!(await rateLimit(`otp:id:${id.value}`, 5, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const current = id.kind === "phone" ? s.user.phone : s.user.email;
  if (current === id.value) return fail("این مورد هم‌اکنون روی حساب شما ثبت است.");
  const taken = await db.user.findFirst({
    where: id.kind === "phone" ? { phone: id.value } : { email: id.value },
    select: { id: true },
  });
  if (taken) return fail("این مورد برای حساب دیگری ثبت شده است.", { identifier: "این مورد برای حساب دیگری ثبت شده است." });

  const result = await issueCode(id, id.kind === "phone" ? "VERIFY_PHONE" : "VERIFY_EMAIL", s.user.id);
  if (!result.ok) {
    return fail(
      result.reason === "cooldown"
        ? `برای ارسال دوبارهٔ کد ${toPersianDigits(result.retryAfterSeconds)} ثانیه صبر کنید.`
        : "ارسال کد ناموفق بود. لطفاً کمی بعد دوباره تلاش کنید.",
    );
  }
  return ok({ masked: maskIdentifier(id), cooldownSeconds: RESEND_COOLDOWN_SECONDS }, "کد تأیید ارسال شد.");
}

export async function confirmContactChange(input: unknown): Promise<ActionResult<undefined>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const parsed = contactConfirmSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  const { ip } = await getRequestInfo();
  if (!(await rateLimit(`verify:ip:${ip}`, 30, 15 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const result = await verifyCode(id.value, id.kind === "phone" ? "VERIFY_PHONE" : "VERIFY_EMAIL", parsed.data.code);
  if (!result.ok || result.userId !== s.user.id) return fail("کد وارد شده صحیح نیست.", { code: "کد وارد شده صحیح نیست." });

  try {
    await db.user.update({
      where: { id: s.user.id },
      data: id.kind === "phone" ? { phone: id.value, phoneVerifiedAt: new Date() } : { email: id.value, emailVerifiedAt: new Date() },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return fail("این مورد برای حساب دیگری ثبت شده است.");
    console.error("[account] contact change failed", error);
    return fail(GENERIC_ERROR);
  }
  await audit({ actorId: s.user.id, action: `account.${id.kind}_changed`, entity: "user", entityId: s.user.id, ip });
  revalidatePath("/account");
  return ok(undefined, id.kind === "phone" ? "شمارهٔ موبایل به‌روزرسانی شد." : "ایمیل به‌روزرسانی شد.");
}

export async function revokeSession(sessionId: string): Promise<ActionResult<undefined>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  if (typeof sessionId !== "string" || sessionId === s.sessionId) return fail("برای خروج از این دستگاه از دکمهٔ خروج استفاده کنید.");
  // Scoped to the current user: cannot revoke someone else's session.
  const { count } = await db.session.deleteMany({ where: { id: sessionId, userId: s.user.id } });
  revalidatePath("/account/security");
  return count ? ok(undefined, "دستگاه از حساب خارج شد.") : fail("این نشست پیدا نشد.");
}

export async function revokeOtherSessions(): Promise<ActionResult<undefined>> {
  const s = await session();
  if (!s) return fail(LOGIN_REQUIRED);
  const count = await revokeUserSessions(s.user.id, s.sessionId);
  revalidatePath("/account/security");
  return ok(undefined, count ? `${toPersianDigits(count)} دستگاه دیگر از حساب خارج شد.` : "دستگاه دیگری وارد حساب نبود.");
}
