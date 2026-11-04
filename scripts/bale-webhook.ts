/**
 * Registers this site as the Bale bot's webhook («پرداخت با کیف پول بله»). Run on the server after setting
 * BALE_BOT_TOKEN / BALE_PROVIDER_TOKEN / PAYMENT_PROVIDER=bale in .env:
 *
 *   pnpm bale:webhook          # set the webhook and show its status
 *   pnpm bale:webhook info     # only show the status
 *   pnpm bale:webhook delete   # remove the webhook
 *
 * The token is never printed. The secret URL segment matches src/features/payments/providers/bale/api.ts.
 */
import { createHash } from "node:crypto";

try {
  process.loadEnvFile(".env");
} catch {
  /* use real environment */
}

const token = process.env.BALE_BOT_TOKEN;
const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
if (!token || !appUrl) {
  console.error("BALE_BOT_TOKEN and APP_URL must be set in .env");
  process.exit(1);
}
const secret = createHash("sha256").update(`atom-bale-webhook:${token}`).digest("hex").slice(0, 40);
const url = `${appUrl}/api/payments/bale/webhook/${secret}`;

async function call(method: string, params: Record<string, unknown> = {}) {
  const res = await fetch(`https://tapi.bale.ai/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null;
  if (!body?.ok) throw new Error(`${method}: HTTP ${res.status} ${body?.description ?? ""}`);
  return body.result;
}

async function main() {
  const mode = process.argv[2] ?? "set";
  const me = (await call("getMe")) as { username?: string };
  console.log(`bot: @${me.username}`);
  if (mode === "delete") {
    await call("deleteWebhook");
    console.log("webhook removed");
  } else if (mode === "set") {
    await call("setWebhook", { url });
    console.log(`webhook set: ${appUrl}/api/payments/bale/webhook/••••`);
  }
  const info = (await call("getWebhookInfo").catch((e: Error) => ({ error: e.message }))) as Record<string, unknown>;
  const { url: current, ...rest } = info;
  console.log("status:", JSON.stringify({ ...rest, url: typeof current === "string" ? (current === url ? "this site ✓" : current ? "another address!" : "(none)") : undefined }));
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
