import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, authenticate, money, readJson } from "@/features/api/auth";
import { DISCOUNT_SCOPES } from "@/features/discounts/rules";
import { DiscountError, previewDiscount } from "@/features/discounts/service";

const schema = z.object({ code: z.string().trim().min(3).max(40), scope: z.enum(DISCOUNT_SCOPES), amountToman: z.number().int().min(0).max(10_000_000_000) });

/** POST { code, scope: "SHOP" | "BOOKING" | "TOURNAMENT", amountToman } → discount (nothing is used up). */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request, "discount:read");
  if (auth instanceof Response) return auth;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(422, "validation_error", "code، scope و amountToman (عدد تومان) لازم است.");
  try {
    const d = await previewDiscount({ code: parsed.data.code, scope: parsed.data.scope, amount: BigInt(parsed.data.amountToman) * BigInt(10), userId: null });
    return apiOk({ valid: true, code: d.code, title: d.title, discount: money(d.discount) });
  } catch (e) {
    if (e instanceof DiscountError) return apiOk({ valid: false, message: e.message });
    throw e;
  }
}
