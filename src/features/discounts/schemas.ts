import { z } from "zod";
import { parseTomanToRial } from "@/lib/text";
import { DISCOUNT_SCOPES, normalizeDiscountCode } from "./rules";

const toman = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const r = parseTomanToRial(v);
      if (r === null) {
        ctx.addIssue({ code: "custom", message: `${label} معتبر نیست` });
        return z.NEVER;
      }
      return r;
    });

const optionalInt = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = Number(v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
    if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "عدد صحیح مثبت وارد کنید" });
      return z.NEVER;
    }
    return n;
  });

/** Admin form (values are strings as typed; Toman → Rials). Dates are ISO instants or "". */
export const discountCodeSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeDiscountCode)
      .pipe(z.string().regex(/^[A-Z0-9_-]{3,40}$/, "کد ۳ تا ۴۰ حرف انگلیسی، عدد، - یا _ باشد")),
    title: z.string().trim().max(120).default(""),
    kind: z.enum(["PERCENT", "FIXED"]),
    value: z.string().trim().min(1, "مقدار تخفیف را وارد کنید"),
    maxDiscountToman: toman("سقف تخفیف"),
    minAmountToman: toman("حداقل مبلغ"),
    scopes: z.array(z.enum(DISCOUNT_SCOPES)).min(1, "حداقل یک بخش را انتخاب کنید"),
    startsAt: z.string().trim().default(""),
    endsAt: z.string().trim().default(""),
    usageLimit: optionalInt,
    perUserLimit: optionalInt,
    isActive: z.boolean().default(true),
  })
  .transform((v, ctx) => {
    let value: bigint;
    if (v.kind === "PERCENT") {
      const n = Number(v.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "درصد بین ۱ تا ۱۰۰ باشد" });
        return z.NEVER;
      }
      value = BigInt(n);
    } else {
      const r = parseTomanToRial(v.value);
      if (!r) {
        ctx.addIssue({ code: "custom", path: ["value"], message: "مبلغ تخفیف (تومان) معتبر نیست" });
        return z.NEVER;
      }
      value = r;
    }
    const date = (s: string, path: string) => {
      if (!s) return null;
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", path: [path], message: "تاریخ معتبر نیست" });
        return null;
      }
      return d;
    };
    const startsAt = date(v.startsAt, "startsAt");
    const endsAt = date(v.endsAt, "endsAt");
    if (startsAt && endsAt && endsAt <= startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "پایان باید بعد از شروع باشد" });
    return {
      code: v.code,
      title: v.title,
      kind: v.kind,
      value,
      maxDiscount: v.kind === "PERCENT" ? v.maxDiscountToman : null,
      minAmount: v.minAmountToman ?? BigInt(0),
      scopes: v.scopes,
      startsAt,
      endsAt,
      usageLimit: v.usageLimit,
      perUserLimit: v.perUserLimit,
      isActive: v.isActive,
    };
  });
