import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { baleProvider } from "./providers/bale";
import { sandboxProvider } from "./providers/sandbox";
import type { PaymentProvider } from "./types";
import { chooseActiveKey } from "./choose";

/**
 * Gateway registry. To add a gateway: write a PaymentProvider in ./providers/<name>, put its credentials in
 * `.env` (validated in src/lib/env.ts) and add one entry here. It then appears in Admin → تنظیمات فروش →
 * «درگاه پرداخت» and can be switched on there — no restart needed.
 */
const REGISTRY: { key: string; provider: PaymentProvider; configured: () => boolean }[] = [
  { key: "bale", provider: baleProvider, configured: () => !!env.BALE_BOT_TOKEN && !!env.BALE_PROVIDER_TOKEN },
  { key: "sandbox", provider: sandboxProvider, configured: () => env.NODE_ENV !== "production" },
];

/** Gateways whose credentials are present (they can verify payments even when not the active one). */
export function configuredProviders(): PaymentProvider[] {
  return REGISTRY.filter((r) => r.configured()).map((r) => r.provider);
}

/**
 * A configured gateway by key, active or not. Callbacks, webhooks and payment pages use this, so payments
 * started on a gateway are still confirmed after the admin switches to another one.
 */
export function getPaymentProviderByKey(key: string): PaymentProvider | null {
  return REGISTRY.find((r) => r.key === key && r.configured())?.provider ?? null;
}

export const PAYMENT_SETTINGS_KEY = "payments";
const settingsSchema = z.object({ activeProvider: z.string().max(30).nullable().optional() });

/** Admin's choice; `undefined` = never chosen (the `.env` PAYMENT_PROVIDER value applies). */
export async function getActiveProviderSetting(): Promise<string | null | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const row = await db.siteSetting.findUnique({ where: { key: PAYMENT_SETTINGS_KEY } });
  const parsed = settingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data.activeProvider : undefined;
}

/** The gateway new payments use, or null while payments are disabled. */
export async function getPaymentProvider(): Promise<PaymentProvider | null> {
  const key = chooseActiveKey(await getActiveProviderSetting(), env.PAYMENT_PROVIDER, configuredProviders().map((p) => p.key));
  return key ? getPaymentProviderByKey(key) : null;
}
