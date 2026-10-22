import { z } from "zod";
import { normalizePersian, parseTomanToRial } from "@/lib/text";

export const SHIPPING_TYPE_LABEL = { PREPAID: "پیش‌کرایه (پرداخت آنلاین)", COLLECT: "پس‌کرایه (پرداخت هنگام تحویل)" } as const;

export const shippingMethodSchema = z
  .object({
    name: z.string().trim().min(2, "نام شرکت/روش ارسال را وارد کنید").max(100).transform(normalizePersian),
    description: z.string().trim().max(300).default(""),
    type: z.enum(["PREPAID", "COLLECT"]),
    priceToman: z.string().trim().default("0"),
    trackingUrl: z
      .string()
      .trim()
      .max(300)
      .default("")
      .refine((v) => v === "" || (/^https:\/\/[^\s]+$/i.test(v) && v.includes("{code}")), "آدرس باید با https شروع شود و شامل {code} باشد"),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  })
  .superRefine((v, ctx) => {
    if (v.type === "PREPAID" && parseTomanToRial(v.priceToman || "0") === null) {
      ctx.addIssue({ code: "custom", path: ["priceToman"], message: "مبلغ معتبر نیست" });
    }
  });

/** Builds the customer tracking link from a method template, or null. */
export function buildTrackingUrl(template: string | null | undefined, code: string | null | undefined): string | null {
  if (!template || !code) return null;
  return template.replace("{code}", encodeURIComponent(code));
}
