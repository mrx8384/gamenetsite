"use server";

import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { env } from "@/lib/env";
import { normalizeIranMobile } from "@/lib/identifiers";
import { sendTemplateSms } from "@/lib/notify/sms";
import { rateLimit } from "@/lib/rate-limit";

type Kind = "otp" | "staff" | "reply";

/** Admin tool: sends one test SMS and reports SMS.ir's exact answer (never the API key). */
export async function sendTestSms(mobileInput: unknown, kind: unknown): Promise<ActionResult<undefined>> {
  let adminId: string;
  try {
    adminId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("دسترسی غیرمجاز.");
    throw e;
  }
  const mobile = typeof mobileInput === "string" ? normalizeIranMobile(mobileInput) : null;
  if (!mobile) return fail("شمارهٔ موبایل معتبر نیست (مثلاً 09121234567).");
  if (kind !== "otp" && kind !== "staff" && kind !== "reply") return fail("نوع پیامک نامعتبر است.");
  if (!(await rateLimit(`sms:test:${adminId}`, 5, 600)).allowed) return fail(RATE_LIMIT_ERROR);

  const t = kind as Kind;
  const templateId = t === "otp" ? env.SMS_TEMPLATE_ID : t === "staff" ? env.SMS_SUPPORT_STAFF_TEMPLATE_ID : env.SMS_SUPPORT_REPLY_TEMPLATE_ID;
  const param = t === "otp" ? { name: env.SMS_TEMPLATE_PARAM, value: "12345" } : { name: "NAME", value: "تست" };

  if (env.SMS_PROVIDER === "log") {
    return fail("SMS_PROVIDER روی «log» است؛ پیامک واقعی فرستاده نمی‌شود. در فایل ‎.env‎ مقدار آن را smsir کنید و سایت را ری‌استارت کنید.");
  }
  if (!templateId) return fail("شمارهٔ قالب این نوع پیامک در فایل ‎.env‎ تنظیم نشده است.");

  try {
    await sendTemplateSms(mobile, templateId, [param]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit({ actorId: adminId, action: "sms.test_failed", entity: "sms", meta: { kind: t, templateId, error: msg.slice(0, 300) } });
    return fail(`SMS.ir پیامک را نپذیرفت: ${msg}`);
  }
  await audit({ actorId: adminId, action: "sms.test_sent", entity: "sms", meta: { kind: t, templateId } });
  return ok(undefined, `پیامک آزمایشی به ${mobile} فرستاده شد (قالب ${templateId}).`);
}
