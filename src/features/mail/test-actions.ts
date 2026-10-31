"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/notify/mail";
import { rateLimit } from "@/lib/rate-limit";

/** Admin tool: sends one test email and reports the mail server's exact answer (never the password). */
export async function sendTestEmail(toInput: unknown): Promise<ActionResult<undefined>> {
  let adminId: string;
  try {
    adminId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("دسترسی غیرمجاز.");
    throw e;
  }
  const to = z.email().safeParse(typeof toInput === "string" ? toInput.trim() : "");
  if (!to.success) return fail("نشانی ایمیل معتبر نیست.");
  if (!(await rateLimit(`mail:test:${adminId}`, 5, 600)).allowed) return fail(RATE_LIMIT_ERROR);
  if (env.MAIL_PROVIDER === "log") {
    return fail("MAIL_PROVIDER روی «log» است؛ ایمیل واقعی فرستاده نمی‌شود. در فایل ‎.env‎ مقدار آن را smtp کنید، اطلاعات SMTP را وارد کنید و سایت را ری‌استارت کنید.");
  }
  try {
    await sendMail({
      to: to.data,
      subject: "ایمیل آزمایشی — اتم گیم کلاب",
      text: "این یک ایمیل آزمایشی از پنل مدیریت سایت است.\nاگر این پیام را می‌بینید، ارسال کد تأیید با ایمیل درست کار می‌کند.\nکد نمونه: 12345",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await audit({ actorId: adminId, action: "mail.test_failed", entity: "mail", meta: { error: msg.slice(0, 300) } });
    return fail(`ارسال ایمیل ناموفق بود: ${msg}`);
  }
  await audit({ actorId: adminId, action: "mail.test_sent", entity: "mail" });
  return ok(undefined, `ایمیل آزمایشی به ${to.data} فرستاده شد. اگر در صندوق ورودی نیست، پوشهٔ Spam را هم ببینید.`);
}
