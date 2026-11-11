"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { createGamenetLicense, gamenetConfigured, GamenetApiError, setGamenetPassword } from "./client";
import { changePasswordSchema, createAccountSchema } from "./rules";
import { loadPartnerTerm } from "./sync";

async function approvedPartner() {
  let s;
  try {
    s = await assertUser();
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
  const partner = await db.partnerProfile.findUnique({ where: { userId: s.user.id }, select: { id: true, status: true } });
  if (!partner || partner.status !== "APPROVED") return null;
  return { user: s.user, partnerId: partner.id };
}

/** An approved partner with a plan that includes the software picks their own username and password. */
export async function createGamenetAccount(input: unknown): Promise<ActionResult<{ username: string }>> {
  const me = await approvedPartner();
  if (!me) return fail("این بخش فقط برای همکاران تأییدشده است.");
  if (!gamenetConfigured()) return fail("ساخت حساب نرم‌افزار در حال حاضر فعال نیست.");
  if (!(await rateLimit(`gamenet-create:${me.user.id}`, 10, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const parsed = createAccountSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));

  const loaded = await loadPartnerTerm(me.partnerId);
  if (!loaded || !loaded.term.entitled || !loaded.term.endsAt) return fail("برای ساخت حساب نرم‌افزار، اشتراکی که شامل «نرم‌افزار مدیریت گیم‌نت» باشد لازم است.");

  try {
    await createGamenetLicense({
      externalId: me.partnerId,
      username: parsed.data.username,
      password: parsed.data.password,
      businessName: loaded.partner.businessName,
      ownerName: loaded.partner.user?.name ?? "",
      phoneNumber: loaded.partner.phone,
      endsAt: loaded.term.endsAt,
      remote: loaded.term.remote,
    });
  } catch (e) {
    if (e instanceof GamenetApiError) {
      if (e.code === "username_taken") return fail("این نام کاربری قبلاً گرفته شده است.", { username: "این نام کاربری قبلاً گرفته شده است؛ نام دیگری انتخاب کنید." });
      if (e.code === "invalid_username") return fail(e.message, { username: e.message });
      if (e.code === "invalid_password") return fail(e.message, { password: e.message });
      if (e.code === "external_exists") {
        revalidatePath("/partner");
        return fail("حساب نرم‌افزار شما قبلاً ساخته شده است.");
      }
      return fail(e.message);
    }
    throw e;
  }

  const { ip } = await getRequestInfo();
  await audit({ actorId: me.user.id, action: "gamenet.account_created", entity: "partner", entityId: me.partnerId, ip, meta: { username: parsed.data.username } });
  revalidatePath("/partner");
  return ok({ username: parsed.data.username }, "حساب نرم‌افزار ساخته شد. حالا می‌توانید برنامه را با همین نام کاربری و رمز فعال کنید.");
}

export async function changeGamenetPassword(input: unknown): Promise<ActionResult<undefined>> {
  const me = await approvedPartner();
  if (!me) return fail("این بخش فقط برای همکاران تأییدشده است.");
  if (!gamenetConfigured()) return fail("اتصال به سرور نرم‌افزار تنظیم نشده است.");
  if (!(await rateLimit(`gamenet-password:${me.user.id}`, 10, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));

  try {
    await setGamenetPassword(me.partnerId, parsed.data.password);
  } catch (e) {
    if (e instanceof GamenetApiError) return fail(e.code === "not_found" ? "هنوز حساب نرم‌افزار نساخته‌اید." : e.message, e.code === "invalid_password" ? { password: e.message } : undefined);
    throw e;
  }
  const { ip } = await getRequestInfo();
  await audit({ actorId: me.user.id, action: "gamenet.password_changed", entity: "partner", entityId: me.partnerId, ip });
  return ok(undefined, "رمز عبور نرم‌افزار تغییر کرد. در برنامه با رمز جدید وارد شوید.");
}
