import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getPaymentProviderByKey } from "@/features/payments";
import { applyGatewayResult, findPaymentTarget } from "@/features/payments/targets";

/**
 * Gateway return URL. The customer's browser lands here; the result is confirmed
 * server-to-server with the gateway (verifyPayment) before anything is marked as paid.
 * Works for every payment kind (order, subscription, tournament entry).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/payments/callback/[provider]">) {
  const { provider: key } = await params;
  const provider = getPaymentProviderByKey(key);
  const qs = request.nextUrl.searchParams;
  const authority = qs.get("authority") ?? qs.get("Authority") ?? "";
  const fallback = new URL("/account/orders", env.APP_URL);
  if (!provider || !authority || authority.length > 100) return NextResponse.redirect(fallback);

  const target = await findPaymentTarget({ provider_authority: { provider: provider.key, authority } });
  if (!target) return NextResponse.redirect(fallback);

  let outcome = "already_processed";
  if (target.status === "INITIATED") {
    try {
      const result = await provider.verifyPayment({ authority, amount: target.amount, callbackParams: qs });
      outcome = (await applyGatewayResult(target.paymentId, result)).result;
    } catch (e) {
      console.error("[payments] callback failed", e);
      outcome = "error";
    }
  } else {
    outcome = target.status === "SUCCEEDED" ? (target.needsRefund ? "late_paid_needs_refund" : "paid") : "failed";
  }
  const back = new URL(target.returnPath, env.APP_URL);
  back.searchParams.set("payment", outcome);
  return NextResponse.redirect(back, { status: 303 });
}
