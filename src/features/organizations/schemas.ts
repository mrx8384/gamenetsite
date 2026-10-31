import { z } from "zod";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} حداکثر ${max.toLocaleString("fa-IR")} کاراکتر`)
    .transform((v) => v || null);

export const organizationSchema = z
  .object({
    name: z.string().trim().min(2, "نام سازمان حداقل ۲ کاراکتر").max(120, "حداکثر ۱۲۰ کاراکتر"),
    logoId: z.string().trim().max(40).optional().transform((v) => v || null),
    description: optionalText(3000, "توضیحات"),
    terms: optionalText(5000, "شرایط قرارداد"),
    website: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || /^https?:\/\/[^\s<>"]+$/i.test(v), "آدرس سایت باید با https:// شروع شود")
      .transform((v) => v || null),
    showDetails: z.boolean(),
    isActive: z.boolean(),
  })
  .refine((v) => !v.showDetails || v.description || v.terms, { path: ["description"], message: "برای باز شدن صفحهٔ جزئیات، توضیحات یا شرایط قرارداد را بنویسید." });

export type OrganizationInput = z.input<typeof organizationSchema>;
