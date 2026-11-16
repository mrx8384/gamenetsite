/** Discount codes: pure rules (unit-tested). Amounts are Rials (bigint). */

export const DISCOUNT_SCOPES = ["SHOP", "BOOKING", "TOURNAMENT"] as const;
export type DiscountScope = (typeof DISCOUNT_SCOPES)[number];
export const SCOPE_LABELS: Record<DiscountScope, string> = { SHOP: "فروشگاه", BOOKING: "رزرو", TOURNAMENT: "تورنومنت" };

/** Smallest amount a gateway payment may have after a discount (1,000 Toman). */
export const MIN_ONLINE_PAYMENT = BigInt(10_000);

export function normalizeDiscountCode(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input
    .trim()
    .replace(/[۰-۹]/g, (d) => String(fa.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ar.indexOf(d)))
    .replace(/\s+/g, "")
    .toUpperCase();
}

export interface DiscountRule {
  kind: string;
  value: bigint;
  maxDiscount: bigint | null;
  minAmount: bigint;
  scopes: string[];
  startsAt: Date | null;
  endsAt: Date | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  isActive: boolean;
}

/** Discount on `amount`, rounded down to whole Toman and never more than the amount. */
export function discountFor(rule: Pick<DiscountRule, "kind" | "value" | "maxDiscount">, amount: bigint): bigint {
  if (amount <= BigInt(0)) return BigInt(0);
  let d = rule.kind === "PERCENT" ? (amount * (rule.value > BigInt(100) ? BigInt(100) : rule.value)) / BigInt(100) : rule.value;
  if (rule.maxDiscount !== null && d > rule.maxDiscount) d = rule.maxDiscount;
  if (d > amount) d = amount;
  d = (d / BigInt(10)) * BigInt(10);
  return d < BigInt(0) ? BigInt(0) : d;
}

/** Keeps at least MIN_ONLINE_PAYMENT to pay when the rest must go through the gateway. */
export function capForGateway(amount: bigint, discount: bigint): bigint {
  if (amount - discount >= MIN_ONLINE_PAYMENT) return discount;
  const d = amount - MIN_ONLINE_PAYMENT;
  return d > BigInt(0) ? d : BigInt(0);
}

/** Why the code cannot be used, or null when it can. `used` = uses still counting. */
export function discountProblem(
  rule: DiscountRule,
  ctx: { scope: DiscountScope; amount: bigint; now: Date; used: number; usedByUser: number; hasUser: boolean },
): string | null {
  if (!rule.isActive) return "این کد تخفیف غیرفعال است.";
  if (!rule.scopes.includes(ctx.scope)) return `این کد برای ${SCOPE_LABELS[ctx.scope]} قابل استفاده نیست.`;
  if (rule.startsAt && ctx.now < rule.startsAt) return "زمان استفاده از این کد هنوز نرسیده است.";
  if (rule.endsAt && ctx.now > rule.endsAt) return "مهلت استفاده از این کد تمام شده است.";
  if (rule.usageLimit !== null && ctx.used >= rule.usageLimit) return "ظرفیت استفاده از این کد تمام شده است.";
  if (rule.perUserLimit !== null && ctx.hasUser && ctx.usedByUser >= rule.perUserLimit) return "شما قبلاً از این کد استفاده کرده‌اید.";
  if (ctx.amount < rule.minAmount) return `این کد برای خرید حداقل ${(rule.minAmount / BigInt(10)).toLocaleString("fa-IR")} تومان است.`;
  if (discountFor(rule, ctx.amount) <= BigInt(0)) return "این کد روی این مبلغ تخفیفی ندارد.";
  return null;
}

/** Persian summary, e.g. «۲۰٪ تا سقف ۵۰٬۰۰۰ تومان». */
export function describeDiscount(rule: Pick<DiscountRule, "kind" | "value" | "maxDiscount">): string {
  const toman = (r: bigint) => `${(r / BigInt(10)).toLocaleString("fa-IR")} تومان`;
  if (rule.kind === "PERCENT") return `${Number(rule.value).toLocaleString("fa-IR")}٪${rule.maxDiscount !== null ? ` تا سقف ${toman(rule.maxDiscount)}` : ""}`;
  return toman(rule.value);
}
