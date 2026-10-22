import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";
import { IRAN_PROVINCES } from "@/lib/provinces";
import { BUSINESS_TYPES } from "./constants";

/** Iranian phone: mobile (09xxxxxxxxx) or landline with area code (0xxxxxxxxxx), 11 digits. */
export function normalizeIranPhone(input: string): string | null {
  let v = toEnglishDigits(input).replace(/[\s\-()]/g, "");
  if (v.startsWith("+98")) v = "0" + v.slice(3);
  else if (v.startsWith("0098")) v = "0" + v.slice(4);
  return /^0[1-9]\d{9}$/.test(v) ? v : null;
}

/** Accepts "@handle", "handle" or an instagram.com URL; returns the bare handle. */
export function normalizeInstagram(input: string): string | null {
  const v = input.trim();
  if (!v) return "";
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:\?.*)?$/i) ?? v.match(/^@?([A-Za-z0-9._]{1,30})$/);
  return m ? m[1] : null;
}

const optionalText = (max: number, msg: string) => z.string().trim().max(max, msg).default("");

export const partnerApplicationSchema = z
  .object({
    businessName: z.string().trim().min(2, "نام کسب‌وکار را وارد کنید").max(150, "حداکثر ۱۵۰ کاراکتر"),
    businessType: z.enum(BUSINESS_TYPES, "نوع کسب‌وکار را انتخاب کنید"),
    province: z.string().refine((v) => (IRAN_PROVINCES as readonly string[]).includes(v), "استان را انتخاب کنید"),
    city: z.string().trim().min(2, "شهر را وارد کنید").max(50, "حداکثر ۵۰ کاراکتر"),
    address: z.string().trim().min(10, "نشانی را کامل وارد کنید").max(300, "حداکثر ۳۰۰ کاراکتر"),
    phone: z.string().trim().max(20).transform((v, ctx) => {
      const n = normalizeIranPhone(v);
      if (!n) ctx.addIssue({ code: "custom", message: "شمارهٔ تماس معتبر نیست (موبایل یا تلفن ثابت با کد شهر)" });
      return n ?? "";
    }),
    website: optionalText(200, "حداکثر ۲۰۰ کاراکتر").refine((v) => v === "" || /^https:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(v), "آدرس سایت باید با https:// شروع شود"),
    instagram: optionalText(100, "حداکثر ۱۰۰ کاراکتر").transform((v, ctx) => {
      const n = normalizeInstagram(v);
      if (n === null) ctx.addIssue({ code: "custom", message: "نام کاربری اینستاگرام معتبر نیست" });
      return n ?? "";
    }),
    description: optionalText(2000, "حداکثر ۲۰۰۰ کاراکتر"),
  });

export type PartnerApplicationInput = z.input<typeof partnerApplicationSchema>;
export type PartnerApplication = z.output<typeof partnerApplicationSchema>;

export const reviewReasonSchema = z.string().trim().min(5, "دلیل را حداقل در ۵ کاراکتر بنویسید").max(500, "حداکثر ۵۰۰ کاراکتر");
