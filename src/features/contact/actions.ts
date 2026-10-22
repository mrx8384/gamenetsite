"use server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hmacHex } from "@/lib/auth/crypto";
import { fail, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { normalizeEmail, normalizeIranMobile } from "@/lib/identifiers";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { contactSchema } from "./schemas";

const SUCCESS = "پیام شما دریافت شد. به‌زودی با شما تماس می‌گیریم.";

export async function submitContactMessage(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { website, startedAt, email, phone, ...rest } = parsed.data;

  // Bots: pretend success so they don't adapt, but store nothing.
  if (website || (startedAt > 0 && Date.now() - startedAt < 3000)) return ok(undefined, SUCCESS);

  const { ip } = await getRequestInfo();
  const [byIp, byDay] = await Promise.all([rateLimit(`contact:ip:${ip}`, 5, 60 * 60), rateLimit(`contact:day:${ip}`, 20, 24 * 60 * 60)]);
  if (!byIp.allowed || !byDay.allowed) return fail(RATE_LIMIT_ERROR);

  await db.contactMessage.create({
    data: {
      ...rest,
      email: email ? normalizeEmail(email) : null,
      phone: phone ? normalizeIranMobile(phone) : null,
      ipHash: hmacHex(env.AUTH_SECRET, `ip:${ip}`), // privacy: raw IPs are not stored
    },
  });
  return ok(undefined, SUCCESS);
}
