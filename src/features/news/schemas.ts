import { z } from "zod";
import { normalizePersian, SLUG_RE } from "@/lib/text";

const slugSchema = z
  .string()
  .trim()
  .min(1, "نامک را وارد کنید")
  .max(100)
  .transform((v) => v.toLowerCase())
  .refine((v) => SLUG_RE.test(v), "نامک فقط می‌تواند شامل حروف، اعداد و خط تیره باشد");

export const newsCategorySchema = z.object({
  name: z.string().trim().min(2, "نام دسته حداقل ۲ حرف است").max(80).transform(normalizePersian),
  slug: slugSchema,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const newsPostSchema = z.object({
  title: z.string().trim().min(3, "عنوان حداقل ۳ حرف است").max(200).transform(normalizePersian),
  slug: slugSchema,
  excerpt: z.string().trim().max(500, "خلاصه حداکثر ۵۰۰ کاراکتر").default(""),
  categoryId: z.string().trim().optional().transform((v) => v || null),
  coverMediaId: z.string().trim().optional().transform((v) => v || null),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  isFeatured: z.boolean().default(false),
  content: z.unknown(),
});
