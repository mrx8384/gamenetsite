import { z } from "zod";
import { toEnglishDigits } from "@/lib/format";
import { normalizeIranMobile } from "@/lib/identifiers";
import { IRAN_PROVINCES } from "@/lib/provinces";

export const addressSchema = z.object({
  recipientName: z.string().trim().min(2, "نام گیرنده را وارد کنید").max(100),
  phone: z
    .string()
    .trim()
    .refine((v) => normalizeIranMobile(v) !== null, "شمارهٔ موبایل معتبر نیست")
    .transform((v) => normalizeIranMobile(v)!),
  province: z.enum(IRAN_PROVINCES, { message: "استان را انتخاب کنید" }),
  city: z.string().trim().min(2, "شهر را وارد کنید").max(50),
  postalCode: z
    .string()
    .trim()
    .transform((v) => toEnglishDigits(v).replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^\d{10}$/, "کد پستی باید ۱۰ رقم باشد")),
  line: z.string().trim().min(10, "نشانی کامل را وارد کنید").max(300),
});

export const placeOrderSchema = z.object({
  addressId: z.string().min(1, "آدرس تحویل را انتخاب کنید"),
  shippingMethodId: z.string().min(1, "روش ارسال را انتخاب کنید"),
  note: z.string().trim().max(500).default(""),
});

export const ORDER_STATUS_LABEL = {
  PENDING: "در انتظار",
  AWAITING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  PROCESSING: "در حال آماده‌سازی",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELLED: "لغوشده",
  REFUNDED: "بازپرداخت‌شده",
} as const;

export const ORDER_STATUS_VARIANT = {
  PENDING: "secondary",
  AWAITING_PAYMENT: "warning",
  PAID: "success",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "destructive",
  REFUNDED: "outline",
} as const;

export type OrderStatusKey = keyof typeof ORDER_STATUS_LABEL;

/** Status changes an admin may make manually. Payment-driven changes happen in the order service. */
export const ADMIN_TRANSITIONS: Record<OrderStatusKey, OrderStatusKey[]> = {
  PENDING: ["CANCELLED"],
  AWAITING_PAYMENT: ["CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};
