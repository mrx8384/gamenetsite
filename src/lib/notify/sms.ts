import "server-only";
import { env } from "@/lib/env";

export class SmsError extends Error {}

/**
 * Sends an SMS.ir "verify" message (a pre-approved template with variables).
 * - "log": prints to the server log instead of sending.
 * - "smsir": SMS.ir verify API.
 */
export async function sendTemplateSms(mobile: string, templateId: number, parameters: { name: string; value: string }[]): Promise<void> {
  if (env.SMS_PROVIDER === "log") {
    console.info(`[sms:log] to=${mobile} template=${templateId} ${parameters.map((p) => `${p.name}=${p.value}`).join(" ")}`);
    return;
  }

  const res = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-KEY": env.SMS_API_KEY! },
    body: JSON.stringify({ mobile, templateId, parameters }),
    signal: AbortSignal.timeout(10_000),
  }).catch((e: unknown) => {
    throw new SmsError(`SMS.ir request failed: ${e instanceof Error ? e.message : String(e)}`);
  });

  const body = (await res.json().catch(() => null)) as { status?: number; message?: string } | null;
  if (!res.ok || body?.status !== 1) {
    // Never log the API key or parameter values (they may contain codes).
    throw new SmsError(`SMS.ir error: HTTP ${res.status}, status=${body?.status}, message=${body?.message}`);
  }
}

/** Sends a one-time code by SMS. */
export async function sendOtpSms(mobile: string, code: string): Promise<void> {
  if (env.SMS_PROVIDER === "log") {
    console.info(`[sms:log] code for ${mobile}: ${code}`);
    return;
  }
  await sendTemplateSms(mobile, env.SMS_TEMPLATE_ID!, [{ name: env.SMS_TEMPLATE_PARAM, value: code }]);
}
