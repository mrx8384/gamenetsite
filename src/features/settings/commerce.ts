import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const COMMERCE_KEY = "commerce";

export const commerceSettingsSchema = z.object({
  /** Online sales switch (checkout and add-to-cart). Can only be turned on when a payment gateway is configured. */
  salesEnabled: z.boolean().default(false),
  /** Phone shown for "call for price" categories. */
  priceInquiryPhone: z.string().max(20).default(""),
});

export type CommerceSettings = z.infer<typeof commerceSettingsSchema>;

export async function getCommerceSettings(): Promise<CommerceSettings> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const row = await db.siteSetting.findUnique({ where: { key: COMMERCE_KEY } });
  const parsed = commerceSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : commerceSettingsSchema.parse({});
}
