"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { toEnglishDigits } from "@/lib/format";
import { getRequestInfo } from "@/lib/request-info";
import { getPaymentProvider } from "@/features/payments";
import { COMMERCE_KEY } from "./commerce";

const inputSchema = z.object({
  salesEnabled: z.boolean(),
  priceInquiryPhone: z
    .string()
    .trim()
    .transform((v) => toEnglishDigits(v).replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+?\d{4,15})?$/, "شمارهٔ تلفن معتبر نیست")),
});

export async function saveCommerceSettings(input: unknown): Promise<ActionResult<undefined>> {
  let userId: string;
  try {
    userId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("دسترسی غیرمجاز.");
    throw e;
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  if (parsed.data.salesEnabled && !getPaymentProvider()) {
    return fail("تا وقتی درگاه پرداخت متصل نشده، فروش آنلاین قابل فعال‌سازی نیست.", { salesEnabled: "درگاه پرداخت متصل نیست." });
  }
  const value = {
    salesEnabled: parsed.data.salesEnabled,
    priceInquiryPhone: parsed.data.priceInquiryPhone,
  };
  await db.siteSetting.upsert({ where: { key: COMMERCE_KEY }, create: { key: COMMERCE_KEY, value }, update: { value } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: userId, action: "settings.commerce_updated", entity: "setting", entityId: COMMERCE_KEY, ip, meta: value });
  updateTag(CACHE_TAGS.settings);
  updateTag(CACHE_TAGS.products);
  return ok(undefined, "تنظیمات فروش ذخیره شد.");
}
