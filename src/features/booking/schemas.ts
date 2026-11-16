import { z } from "zod";
import { parseTomanToRial } from "@/lib/text";
import { toEnglishDigits } from "@/lib/format";
import { isDayKey, normalizeEnd, parseTime, PAYMENT_MODES } from "./rules";

export const bookingConfigSchema = z.object({
  /** Days ahead customers can book (today included). */
  daysAhead: z.coerce.number().int().min(1).max(180).default(30),
  /** Bookings close this many hours before a shift starts. */
  minHoursBefore: z.coerce.number().int().min(0).max(72).default(2),
  /** Minutes an unpaid online booking holds its shift. */
  paymentMinutes: z.coerce.number().int().min(5).max(60).default(20),
  askGuests: z.boolean().default(true),
  maxGuests: z.coerce.number().int().min(1).max(1000).default(50),
});
export type BookingConfig = z.infer<typeof bookingConfigSchema>;

/** Admin shift form (times "HH:mm", price in Toman). */
export const shiftSchema = z
  .object({
    title: z.string().trim().min(2, "عنوان شیفت را وارد کنید").max(60),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1, "حداقل یک روز را انتخاب کنید"),
    start: z.string(),
    end: z.string(),
    capacity: z.coerce.number().int().min(1, "حداقل ۱").max(100),
    priceToman: z.string().trim(),
    paymentMode: z.enum(PAYMENT_MODES),
    depositPercent: z.coerce.number().int().min(1).max(99).default(30),
    description: z.string().trim().max(300).default(""),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .transform((v, ctx) => {
    const start = parseTime(v.start);
    const endRaw = parseTime(v.end);
    if (start === null) ctx.addIssue({ code: "custom", path: ["start"], message: "ساعت شروع را مثل 18:00 وارد کنید" });
    if (endRaw === null) ctx.addIssue({ code: "custom", path: ["end"], message: "ساعت پایان را مثل 22:00 وارد کنید" });
    const end = start !== null && endRaw !== null ? normalizeEnd(start, endRaw) : null;
    if (start !== null && endRaw !== null && end === null) ctx.addIssue({ code: "custom", path: ["end"], message: "شیفت حداقل ۳۰ دقیقه و حداکثر تا ۶ صبح روز بعد" });
    const price = parseTomanToRial(v.priceToman || "0");
    if (price === null) ctx.addIssue({ code: "custom", path: ["priceToman"], message: "قیمت معتبر نیست" });
    else if (v.paymentMode !== "ON_SITE" && price < BigInt(10_000)) ctx.addIssue({ code: "custom", path: ["priceToman"], message: "برای پرداخت آنلاین، قیمت حداقل ۱٬۰۰۰ تومان باشد" });
    if (start === null || end === null || price === null) return z.NEVER;
    return {
      title: v.title,
      weekdays: [...new Set(v.weekdays)].sort(),
      startMinute: start,
      endMinute: end,
      capacity: v.capacity,
      price,
      paymentMode: v.paymentMode,
      depositPercent: v.paymentMode === "DEPOSIT" ? v.depositPercent : null,
      description: v.description || null,
      isActive: v.isActive,
      sortOrder: v.sortOrder,
    };
  });

export const closureSchema = z.object({
  date: z.string().refine(isDayKey, "تاریخ معتبر نیست"),
  reason: z.string().trim().max(200).default(""),
});

const phone = z
  .string()
  .trim()
  .transform((v) => toEnglishDigits(v).replace(/[\s-]/g, ""))
  .pipe(z.string().regex(/^(\+98|0)?9\d{9}$|^0\d{9,10}$/, "شمارهٔ تماس معتبر نیست"));

/** A new booking (website, admin or API). */
export const newBookingSchema = z.object({
  date: z.string().refine(isDayKey, "تاریخ معتبر نیست"),
  shiftId: z.string().min(1, "شیفت را انتخاب کنید").max(40),
  name: z.string().trim().min(2, "نام را وارد کنید").max(80),
  phone,
  guests: z.coerce.number().int().min(1).max(1000).optional().nullable(),
  note: z.string().trim().max(500).default(""),
  discountCode: z.string().trim().max(40).default(""),
});
export type NewBookingInput = z.infer<typeof newBookingSchema>;
