import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";

/**
 * Partner prices are shown to (and charged to) approved partners the admin chose with
 * «نمایش قیمت همکاری» — not tied to a subscription (owner request 2026-11-04).
 */
export async function canSeePartnerPrices(userId: string): Promise<boolean> {
  const p = await db.partnerProfile.findUnique({ where: { userId }, select: { status: true, showPartnerPrices: true, user: { select: { role: true, isActive: true } } } });
  return !!p && p.status === "APPROVED" && p.showPartnerPrices && p.user.isActive && p.user.role !== "USER" && p.user.role !== "SUPPORT";
}

/** For the current visitor: null when they may not see partner prices, else productId → partner price (Rials). Once per request. */
export const partnerPricesForRequest = cache(async (): Promise<Map<string, bigint> | null> => {
  const user = await getCurrentUser();
  if (!user || !(await canSeePartnerPrices(user.id))) return null;
  const rows = await db.product.findMany({ where: { partnerPrice: { not: null }, status: "ACTIVE" }, select: { id: true, partnerPrice: true, price: true } });
  return new Map(rows.filter((r) => r.partnerPrice! < r.price).map((r) => [r.id, r.partnerPrice!]));
});
