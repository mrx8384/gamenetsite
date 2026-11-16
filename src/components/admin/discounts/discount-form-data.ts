import { DISCOUNT_SCOPES, type DiscountScope } from "@/features/discounts/rules";
import { isoToTehranInput } from "@/features/tournaments/time";

export interface DiscountFormData {
  id?: string;
  code: string;
  title: string;
  kind: "PERCENT" | "FIXED";
  value: string;
  maxDiscountToman: string;
  minAmountToman: string;
  scopes: DiscountScope[];
  /** Tehran local "yyyy-MM-ddTHH:mm" or "". */
  startsAt: string;
  endsAt: string;
  usageLimit: string;
  perUserLimit: string;
  isActive: boolean;
}


export const toDiscountForm = (c: { id: string; code: string; title: string; kind: string; value: string; maxDiscount: string | null; minAmount: string; scopes: string[]; startsAt: string | null; endsAt: string | null; usageLimit: number | null; perUserLimit: number | null; isActive: boolean }): DiscountFormData => ({
  id: c.id,
  code: c.code,
  title: c.title,
  kind: c.kind === "FIXED" ? "FIXED" : "PERCENT",
  value: c.kind === "FIXED" ? (BigInt(c.value) / BigInt(10)).toString() : c.value,
  maxDiscountToman: c.maxDiscount ? (BigInt(c.maxDiscount) / BigInt(10)).toString() : "",
  minAmountToman: c.minAmount !== "0" ? (BigInt(c.minAmount) / BigInt(10)).toString() : "",
  scopes: c.scopes.filter((s): s is DiscountScope => (DISCOUNT_SCOPES as readonly string[]).includes(s)),
  startsAt: isoToTehranInput(c.startsAt),
  endsAt: isoToTehranInput(c.endsAt),
  usageLimit: c.usageLimit?.toString() ?? "",
  perUserLimit: c.perUserLimit?.toString() ?? "",
  isActive: c.isActive,
});
