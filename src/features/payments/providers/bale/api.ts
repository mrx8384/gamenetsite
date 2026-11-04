import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

export class BaleApiError extends Error {}

/** Calls the Bale bot API (https://tapi.bale.ai/bot<token>/<method>). Never logs the token. */
export async function bale<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://tapi.bale.ai/bot${env.BALE_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? ` (${(e.cause as NodeJS.ErrnoException).code ?? e.cause.message})` : "";
    throw new BaleApiError(`Bale ${method} request failed: ${e instanceof Error ? e.message : String(e)}${cause}`);
  }
  const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string; error_code?: number } | null;
  if (!res.ok || !body?.ok) throw new BaleApiError(`Bale ${method} error: HTTP ${res.status} ${body?.error_code ?? ""} ${body?.description ?? ""}`.trim());
  return body.result as T;
}

let usernameCache: { value: string; at: number } | null = null;

/** The bot's username for links (getMe, cached for an hour). */
export async function botUsername(): Promise<string> {
  if (usernameCache && Date.now() - usernameCache.at < 3_600_000) return usernameCache.value;
  const me = await bale<{ username?: string }>("getMe");
  if (!me.username) throw new BaleApiError("Bale getMe returned no username");
  usernameCache = { value: me.username, at: Date.now() };
  return me.username;
}

/** Secret part of the webhook URL, derived from the bot token (nothing extra to configure). */
export function webhookSecret(): string {
  return createHash("sha256").update(`atom-bale-webhook:${env.BALE_BOT_TOKEN ?? ""}`).digest("hex").slice(0, 40);
}

export function isTestToken(): boolean {
  return (env.BALE_PROVIDER_TOKEN ?? "").startsWith("WALLET-TEST");
}
