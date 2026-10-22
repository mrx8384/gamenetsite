import { z } from "zod";
import { normalizeEmail, normalizeIranMobile } from "@/lib/identifiers";

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "نام خود را وارد کنید").max(100),
    email: z.string().trim().max(254).default(""),
    phone: z.string().trim().max(20).default(""),
    subject: z.string().trim().min(3, "موضوع را وارد کنید").max(200),
    body: z.string().trim().min(10, "متن پیام حداقل ۱۰ کاراکتر باشد").max(5000, "متن پیام حداکثر ۵۰۰۰ کاراکتر"),
    /** Honeypot: hidden from humans, bots fill it. */
    website: z.string().max(200).default(""),
    /** ms timestamp when the form was rendered (very fast submissions are bots). */
    startedAt: z.coerce.number().int().default(0),
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) ctx.addIssue({ code: "custom", path: ["email"], message: "ایمیل یا شمارهٔ موبایل را وارد کنید" });
    if (v.email && !normalizeEmail(v.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "ایمیل معتبر نیست" });
    if (v.phone && !normalizeIranMobile(v.phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: "شمارهٔ موبایل معتبر نیست" });
  });
