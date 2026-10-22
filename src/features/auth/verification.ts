import "server-only";
import type { VerificationPurpose } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateNumericCode, hmacHex, safeEqualHex } from "@/lib/auth/crypto";
import type { Identifier } from "@/lib/identifiers";
import { sendMail } from "@/lib/notify/mail";
import { sendOtpSms } from "@/lib/notify/sms";

const CODE_TTL_MS = { phone: 2 * 60 * 1000, email: 15 * 60 * 1000 } as const;
export const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

const purposeLabel: Record<VerificationPurpose, string> = {
  LOGIN: "ورود",
  PASSWORD_RESET: "بازیابی رمز عبور",
  VERIFY_EMAIL: "تأیید ایمیل",
  VERIFY_PHONE: "تأیید شماره موبایل",
};

function codeHash(purpose: VerificationPurpose, target: string, code: string) {
  return hmacHex(env.AUTH_SECRET, `${purpose}:${target}:${code}`);
}

export type IssueResult = { ok: true } | { ok: false; reason: "cooldown"; retryAfterSeconds: number } | { ok: false; reason: "send_failed" };

/** Creates a new code (invalidating older ones for the same target/purpose) and sends it. */
export async function issueCode(id: Identifier, purpose: VerificationPurpose, userId: string | null): Promise<IssueResult> {
  const last = await db.verificationCode.findFirst({
    where: { target: id.value, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last) {
    const elapsed = (Date.now() - last.createdAt.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return { ok: false, reason: "cooldown", retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed) };
    }
  }

  const code = generateNumericCode(6);
  const now = new Date();
  await db.$transaction([
    db.verificationCode.updateMany({ where: { target: id.value, purpose, usedAt: null }, data: { usedAt: now } }),
    db.verificationCode.create({
      data: {
        userId,
        channel: id.kind === "phone" ? "SMS" : "EMAIL",
        target: id.value,
        purpose,
        codeHash: codeHash(purpose, id.value, code),
        expiresAt: new Date(now.getTime() + CODE_TTL_MS[id.kind]),
      },
    }),
  ]);

  try {
    if (id.kind === "phone") {
      await sendOtpSms(id.value, code);
    } else {
      await sendMail({
        to: id.value,
        subject: `کد ${purposeLabel[purpose]} — آتم گیم کلاب`,
        text: `کد ${purposeLabel[purpose]} شما: ${code}\nاین کد تا ۱۵ دقیقه معتبر است. اگر این درخواست را شما نداده‌اید، این پیام را نادیده بگیرید.`,
      });
    }
    return { ok: true };
  } catch (error) {
    console.error("[verification] sending failed", error);
    return { ok: false, reason: "send_failed" };
  }
}

export type VerifyResult = { ok: true; userId: string | null } | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/** Checks a code. Each wrong guess counts; the code is single-use. */
export async function verifyCode(target: string, purpose: VerificationPurpose, code: string): Promise<VerifyResult> {
  const record = await db.verificationCode.findFirst({
    where: { target, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, reason: "invalid" };
  if (record.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  if (!/^\d{6}$/.test(code) || !safeEqualHex(record.codeHash, codeHash(purpose, target, code))) {
    const updated = await db.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    return { ok: false, reason: updated.attempts >= MAX_ATTEMPTS ? "too_many_attempts" : "invalid" };
  }

  // Atomic single-use: only succeeds if still unused.
  const { count } = await db.verificationCode.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (count === 0) return { ok: false, reason: "invalid" };
  return { ok: true, userId: record.userId };
}
