import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getPaymentProviderByKey } from "@/features/payments";
import { applyPaymentResult } from "@/features/orders/service";

/**
 * Gateway return URL. The customer's browser lands here; the result is confirmed
 * server-to-server with the gateway (verifyPayment) before anything is marked as paid.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/payments/callback/[provider]">) {
  const { provider: key } = await params;
  const provider = getPaymentProviderByKey(key);
  const qs = request.nextUrl.searchParams;
  const authority = qs.get("authority") ?? qs.get("Authority") ?? "";
  const fallback = new URL("/account/orders", env.APP_URL);
  if (!provider || !authority || authority.length > 100) return NextResponse.redirect(fallback);

  const payment = await db.payment.findUnique({
    where: { provider_authority: { provider: provider.key, authority } },
    select: { id: true, amount: true, status: true, order: { select: { number: true } } },
  });
  if (!payment?.order) return NextResponse.redirect(fallback);

  let outcome = "already_processed";
  if (payment.status === "INITIATED") {
    try {
      const result = await provider.verifyPayment({ authority, amount: payment.amount, callbackParams: qs });
      outcome = (await applyPaymentResult(payment.id, result)).result;
    } catch (e) {
      console.error("[payments] callback failed", e);
      outcome = "error";
    }
  } else {
    outcome = payment.status === "SUCCEEDED" ? "paid" : "failed";
  }
  const target = new URL(`/account/orders/${encodeURIComponent(payment.order.number)}`, env.APP_URL);
  target.searchParams.set("payment", outcome);
  return NextResponse.redirect(target, { status: 303 });
}
