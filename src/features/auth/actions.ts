"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession, revokeUserSessions } from "@/lib/auth/session";
import { fail, GENERIC_ERROR, isUniqueViolation, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { maskIdentifier, parseIdentifier, safeRedirectPath, type Identifier } from "@/lib/identifiers";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { toPersianDigits } from "@/lib/format";
import {
  loginCodeSchema,
  loginPasswordSchema,
  registerCompleteSchema,
  registerStartSchema,
  requestCodeSchema,
  resetPasswordSchema,
} from "./schemas";
import { issueCode, RESEND_COOLDOWN_SECONDS, smsCodesAvailable, verifyCode, type IssueResult, type VerifyResult } from "./verification";

type CodeSent = { masked: string; cooldownSeconds: number };

const userWhere = (id: Identifier) => (id.kind === "email" ? { email: id.value } : { phone: id.value });

/** Shown while SMS is not live: codes can only go to email. */
const SMS_OFF = {
  login: "ارسال کد با پیامک فعلاً فعال نیست. با رمز عبور یا با ایمیل حساب خود وارد شوید.",
  register: "ثبت‌نام با شمارهٔ موبایل فعلاً ممکن نیست (پیامک فعال نشده). لطفاً با ایمیل ثبت‌نام کنید.",
  reset: "بازیابی رمز با پیامک فعلاً فعال نیست. اگر ایمیل در حسابتان ثبت است، ایمیل را وارد کنید؛ وگرنه با پشتیبانی تماس بگیرید.",
} as const;

function issueError(result: Exclude<IssueResult, { ok: true }>): ActionResult<never> {
  if (result.reason === "cooldown") {
    return fail(`برای ارسال دوبارهٔ کد ${toPersianDigits(result.retryAfterSeconds)} ثانیه صبر کنید.`);
  }
  return fail("ارسال کد ناموفق بود. لطفاً کمی بعد دوباره تلاش کنید.");
}

function verifyError(result: Exclude<VerifyResult, { ok: true }>): ActionResult<never> {
  const messages = {
    invalid: "کد وارد شده صحیح نیست.",
    expired: "کد منقضی شده است. کد جدید دریافت کنید.",
    too_many_attempts: "تعداد تلاش‌های نادرست زیاد بود. کد جدید دریافت کنید.",
  } as const;
  return fail(messages[result.reason], { code: messages[result.reason] });
}

// ───────────── Login with password ─────────────

export async function loginWithPassword(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  const { ip, userAgent } = await getRequestInfo();

  const [byIp, byId] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 30, 15 * 60),
    rateLimit(`login:id:${id.value}`, 8, 15 * 60),
  ]);
  if (!byIp.allowed || !byId.allowed) return fail(RATE_LIMIT_ERROR);

  const user = await db.user.findUnique({ where: userWhere(id), select: { id: true, passwordHash: true, isActive: true } });
  if (!user) {
    await burnPasswordCheck(parsed.data.password);
    return fail("ایمیل/شماره یا رمز عبور اشتباه است.");
  }
  if (!(await verifyPassword(user.passwordHash, parsed.data.password))) {
    await audit({ actorId: user.id, action: "auth.login_failed", entity: "user", entityId: user.id, ip });
    return fail("ایمیل/شماره یا رمز عبور اشتباه است.");
  }
  if (!user.isActive) return fail("حساب کاربری شما غیرفعال شده است. با پشتیبانی تماس بگیرید.");

  await createSession(user.id, { ip, userAgent });
  await resetRateLimit(`login:id:${id.value}`);
  await audit({ actorId: user.id, action: "auth.login", entity: "user", entityId: user.id, ip, meta: { method: "password" } });
  return ok({ redirectTo: safeRedirectPath(parsed.data.next, "/account") });
}

// ───────────── Login with one-time code ─────────────

export async function requestLoginCode(input: unknown): Promise<ActionResult<CodeSent>> {
  const parsed = requestCodeSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  if (id.kind === "phone" && !smsCodesAvailable()) return fail(SMS_OFF.login, { identifier: SMS_OFF.login });
  const { ip } = await getRequestInfo();

  const [byIp, byTarget] = await Promise.all([rateLimit(`otp:ip:${ip}`, 10, 60 * 60), rateLimit(`otp:id:${id.value}`, 5, 60 * 60)]);
  if (!byIp.allowed || !byTarget.allowed) return fail(RATE_LIMIT_ERROR);

  const user = await db.user.findUnique({ where: userWhere(id), select: { id: true, isActive: true } });
  // Same response whether or not the account exists (prevents account enumeration).
  if (user?.isActive) {
    const result = await issueCode(id, "LOGIN", user.id);
    if (!result.ok) return issueError(result);
  }
  return ok(
    { masked: maskIdentifier(id), cooldownSeconds: RESEND_COOLDOWN_SECONDS },
    "اگر حسابی با این مشخصات وجود داشته باشد، کد ورود ارسال شد.",
  );
}

export async function loginWithCode(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = loginCodeSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  const { ip, userAgent } = await getRequestInfo();

  if (!(await rateLimit(`verify:ip:${ip}`, 30, 15 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const result = await verifyCode(id.value, "LOGIN", parsed.data.code);
  if (!result.ok) return verifyError(result);

  const user = await db.user.findUnique({ where: userWhere(id), select: { id: true, isActive: true } });
  if (!user || user.id !== result.userId) return fail("کد وارد شده صحیح نیست.");
  if (!user.isActive) return fail("حساب کاربری شما غیرفعال شده است. با پشتیبانی تماس بگیرید.");

  // A received code proves ownership of the contact.
  await db.user.update({
    where: { id: user.id },
    data: id.kind === "phone" ? { phoneVerifiedAt: new Date() } : { emailVerifiedAt: new Date() },
  });
  await createSession(user.id, { ip, userAgent });
  await audit({ actorId: user.id, action: "auth.login", entity: "user", entityId: user.id, ip, meta: { method: "code" } });
  return ok({ redirectTo: safeRedirectPath(parsed.data.next, "/account") });
}

// ───────────── Registration (2 steps: send code → confirm) ─────────────

export async function startRegistration(input: unknown): Promise<ActionResult<CodeSent>> {
  const parsed = registerStartSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  if (id.kind === "phone" && !smsCodesAvailable()) return fail(SMS_OFF.register, { identifier: SMS_OFF.register });
  const { ip } = await getRequestInfo();

  const [byIp, byTarget] = await Promise.all([rateLimit(`register:ip:${ip}`, 10, 60 * 60), rateLimit(`otp:id:${id.value}`, 5, 60 * 60)]);
  if (!byIp.allowed || !byTarget.allowed) return fail(RATE_LIMIT_ERROR);

  const exists = await db.user.findUnique({ where: userWhere(id), select: { id: true } });
  if (exists) {
    const label = id.kind === "phone" ? "این شمارهٔ موبایل" : "این ایمیل";
    return fail(`${label} قبلاً ثبت شده است. لطفاً وارد شوید.`, { identifier: `${label} قبلاً ثبت شده است.` });
  }

  const result = await issueCode(id, id.kind === "phone" ? "VERIFY_PHONE" : "VERIFY_EMAIL", null);
  if (!result.ok) return issueError(result);
  return ok({ masked: maskIdentifier(id), cooldownSeconds: RESEND_COOLDOWN_SECONDS }, "کد تأیید ارسال شد.");
}

export async function completeRegistration(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = registerCompleteSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { name, password, code } = parsed.data;
  const id = parseIdentifier(parsed.data.identifier)!;
  const { ip, userAgent } = await getRequestInfo();

  if (!(await rateLimit(`verify:ip:${ip}`, 30, 15 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const result = await verifyCode(id.value, id.kind === "phone" ? "VERIFY_PHONE" : "VERIFY_EMAIL", code);
  if (!result.ok) return verifyError(result);

  try {
    const now = new Date();
    const user = await db.user.create({
      data: {
        name,
        passwordHash: await hashPassword(password),
        ...(id.kind === "phone" ? { phone: id.value, phoneVerifiedAt: now } : { email: id.value, emailVerifiedAt: now }),
      },
      select: { id: true },
    });
    await createSession(user.id, { ip, userAgent });
    await audit({ actorId: user.id, action: "auth.register", entity: "user", entityId: user.id, ip });
    return ok({ redirectTo: "/account" }, "ثبت‌نام با موفقیت انجام شد.");
  } catch (error) {
    if (isUniqueViolation(error)) return fail("این حساب قبلاً ثبت شده است. لطفاً وارد شوید.");
    console.error("[auth] registration failed", error);
    return fail(GENERIC_ERROR);
  }
}

// ───────────── Password recovery ─────────────

export async function requestPasswordReset(input: unknown): Promise<ActionResult<CodeSent>> {
  const parsed = requestCodeSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات وارد شده معتبر نیست.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  if (id.kind === "phone" && !smsCodesAvailable()) return fail(SMS_OFF.reset, { identifier: SMS_OFF.reset });
  const { ip } = await getRequestInfo();

  const [byIp, byTarget] = await Promise.all([rateLimit(`reset:ip:${ip}`, 10, 60 * 60), rateLimit(`otp:id:${id.value}`, 5, 60 * 60)]);
  if (!byIp.allowed || !byTarget.allowed) return fail(RATE_LIMIT_ERROR);

  const user = await db.user.findUnique({ where: userWhere(id), select: { id: true, isActive: true } });
  if (user?.isActive) {
    const result = await issueCode(id, "PASSWORD_RESET", user.id);
    if (!result.ok) return issueError(result);
  }
  return ok(
    { masked: maskIdentifier(id), cooldownSeconds: RESEND_COOLDOWN_SECONDS },
    "اگر حسابی با این مشخصات وجود داشته باشد، کد بازیابی ارسال شد.",
  );
}

export async function resetPassword(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const id = parseIdentifier(parsed.data.identifier)!;
  const { ip, userAgent } = await getRequestInfo();

  if (!(await rateLimit(`verify:ip:${ip}`, 30, 15 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const result = await verifyCode(id.value, "PASSWORD_RESET", parsed.data.code);
  if (!result.ok) return verifyError(result);

  const user = await db.user.findUnique({ where: userWhere(id), select: { id: true, isActive: true } });
  if (!user || user.id !== result.userId || !user.isActive) return fail("کد وارد شده صحیح نیست.");

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      sessionVersion: { increment: 1 },
      ...(id.kind === "phone" ? { phoneVerifiedAt: new Date() } : { emailVerifiedAt: new Date() }),
    },
  });
  await revokeUserSessions(user.id); // log out everywhere
  await createSession(user.id, { ip, userAgent });
  await resetRateLimit(`login:id:${id.value}`);
  await audit({ actorId: user.id, action: "auth.password_reset", entity: "user", entityId: user.id, ip });
  return ok({ redirectTo: "/account" }, "رمز عبور با موفقیت تغییر کرد.");
}

// ───────────── Logout ─────────────

export async function logout(): Promise<void> {
  await destroyCurrentSession();
  redirect("/");
}
