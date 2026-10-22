import { z } from "zod";
import { normalizePersian, parseTomanToRial, SLUG_RE } from "@/lib/text";
import { toEnglishDigits } from "@/lib/format";

const slugSchema = z
  .string()
  .trim()
  .min(1, "نامک (slug) را وارد کنید")
  .max(100)
  .transform((v) => v.toLowerCase())
  .refine((v) => SLUG_RE.test(v), "نامک فقط می‌تواند شامل حروف، اعداد و خط تیره باشد");

/** Toman input → Rial bigint (as string to stay serializable). */
const tomanSchema = z
  .string()
  .trim()
  .refine((v) => parseTomanToRial(v) !== null, "مبلغ معتبر نیست (فقط عدد، به تومان)")
  .transform((v) => parseTomanToRial(v)!.toString());

const optionalToman = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || parseTomanToRial(v) !== null, "مبلغ معتبر نیست")
  .transform((v) => (v === null ? null : parseTomanToRial(v)!.toString()));

export const categorySchema = z.object({
  name: z.string().trim().min(2, "نام دسته حداقل ۲ حرف است").max(80).transform(normalizePersian),
  slug: slugSchema,
  description: z.string().trim().max(1000).optional().default(""),
  parentId: z.string().trim().optional().transform((v) => v || null),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  priceOnRequest: z.boolean().default(false),
});

export const productImageSchema = z.object({ mediaId: z.string().min(1), alt: z.string().trim().max(200).default("") });

export const productSchema = z
  .object({
    title: z.string().trim().min(2, "عنوان حداقل ۲ حرف است").max(200).transform(normalizePersian),
    slug: slugSchema,
    sku: z
      .string()
      .trim()
      .transform((v) => toEnglishDigits(v).toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{2,64}$/, "کد کالا (SKU) فقط حروف انگلیسی، عدد و خط تیره")),
    categoryId: z.string().trim().optional().transform((v) => v || null),
    shortDescription: z.string().trim().max(500, "توضیح کوتاه حداکثر ۵۰۰ کاراکتر").default(""),
    description: z.string().trim().max(20000).default(""),
    price: tomanSchema,
    compareAtPrice: optionalToman,
    status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
    isFeatured: z.boolean().default(false),
    images: z.array(productImageSchema).max(12, "حداکثر ۱۲ تصویر").default([]),
  })
  .refine((p) => p.compareAtPrice === null || BigInt(p.compareAtPrice) > BigInt(p.price), {
    path: ["compareAtPrice"],
    message: "قیمت قبل از تخفیف باید از قیمت فعلی بیشتر باشد",
  });

export const createProductSchema = productSchema.and(
  z.object({ initialStock: z.coerce.number().int().min(0, "موجودی نمی‌تواند منفی باشد").max(1_000_000).default(0) }),
);

export const stockAdjustSchema = z.object({
  delta: z.coerce
    .number()
    .int("فقط عدد صحیح")
    .refine((v) => v !== 0, "تغییر موجودی نمی‌تواند صفر باشد")
    .refine((v) => Math.abs(v) <= 1_000_000, "عدد بیش از حد بزرگ است"),
  reason: z.enum(["MANUAL", "RETURN", "CORRECTION"]),
  note: z.string().trim().max(300).default(""),
});

export type ProductInput = z.input<typeof productSchema>;
