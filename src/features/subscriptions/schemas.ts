import { z } from "zod";
import { parseTomanToRial } from "@/lib/text";
import { toEnglishDigits } from "@/lib/format";
import { ENTITLEMENT_KEYS } from "./constants";

export const planSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "کد فقط حروف انگلیسی کوچک، عدد و خط تیره")
    .max(50, "حداکثر ۵۰ کاراکتر"),
  name: z.string().trim().min(2, "نام اشتراک را وارد کنید").max(100, "حداکثر ۱۰۰ کاراکتر"),
  description: z.string().trim().max(1000, "حداکثر ۱۰۰۰ کاراکتر").default(""),
  priceToman: z.string().transform((v, ctx) => {
    const rial = parseTomanToRial(v || "0");
    if (rial === null || rial < BigInt(0)) ctx.addIssue({ code: "custom", message: "قیمت معتبر نیست" });
    return rial ?? BigInt(0);
  }),
  durationDays: z.preprocess((v) => (typeof v === "string" ? toEnglishDigits(v) : v), z.coerce.number("مدت معتبر نیست").int("مدت باید عدد صحیح باشد").min(1, "حداقل ۱ روز").max(3650, "حداکثر ۳۶۵۰ روز")),
  features: z.array(z.enum(ENTITLEMENT_KEYS)).max(ENTITLEMENT_KEYS.length).default([]),
  isVisible: z.boolean().default(false),
  sortOrder: z.preprocess((v) => (typeof v === "string" ? toEnglishDigits(v) : v), z.coerce.number().int().min(0).max(9999)).default(0),
});

export type PlanInput = z.input<typeof planSchema>;
