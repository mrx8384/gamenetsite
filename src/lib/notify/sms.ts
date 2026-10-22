import "server-only";
import { env } from "@/lib/env";

export class SmsError extends Error {}

/**
 * Sends a one-time code by SMS.
 * - "log": prints to the server log (development only).
 * - "smsir": SMS.ir "verify" API with a pre-approved template.
 */
export async function sendOtpSms(mobile: string, code: string): Promise<void> {
  if (env.SMS_PROVIDER === "log") {
    console.info(`[sms:log] code for ${mobile}: ${code}`);
    return;
  }

  const res = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "X-API-KEY": env.SMS_API_KEY! },
    body: JSON.stringify({
      mobile,
      templateId: env.SMS_TEMPLATE_ID,
      parameters: [{ name: env.SMS_TEMPLATE_PARAM, value: code }],
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch((e: unknown) => {
    throw new SmsError(`SMS.ir request failed: ${e instanceof Error ? e.message : String(e)}`);
  });

  const body = (await res.json().catch(() => null)) as { status?: number; message?: string } | null;
  if (!res.ok || body?.status !== 1) {
    // Never log the API key or the code.
    throw new SmsError(`SMS.ir error: HTTP ${res.status}, status=${body?.status}, message=${body?.message}`);
  }
}
