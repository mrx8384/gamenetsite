import { connection, NextResponse, type NextRequest } from "next/server";
import { getPaymentProviderByKey } from "@/features/payments";
import { confirmBalePayment } from "@/features/payments/providers/bale/updates";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

/** Polled by the payment page: the payment's state for its owner (re-checks Bale if confirmation is pending). */
export async function GET(req: NextRequest) {
  await connection();
  const headers = { "Cache-Control": "private, no-store" };
  const user = await getCurrentUser();
  const code = req.nextUrl.searchParams.get("code") ?? "";
  if (!user || !getPaymentProviderByKey("bale") || !code || code.length > 60) return NextResponse.json({ status: "unknown" }, { status: 404, headers });
  if (!(await rateLimit(`bale:status:${user.id}`, 120, 600)).allowed) return NextResponse.json({ status: "pending" }, { headers });
  const p = await db.payment.findUnique({
    where: { provider_authority: { provider: "bale", authority: code } },
    select: { id: true, status: true, raw: true, order: { select: { number: true, userId: true, status: true } } },
  });
  if (!p?.order || p.order.userId !== user.id) return NextResponse.json({ status: "unknown" }, { status: 404, headers });
  let status: string = p.status === "SUCCEEDED" ? "paid" : p.status === "INITIATED" ? (p.order.status === "AWAITING_PAYMENT" ? "pending" : "expired") : "failed";
  const txId = p.raw && typeof p.raw === "object" ? (p.raw as Record<string, unknown>).baleTransactionId : undefined;
  if (p.status === "INITIATED" && typeof txId === "string") {
    try {
      const r = await confirmBalePayment(p.id, txId);
      if (r === "paid" || r === "already_processed") status = "paid";
      else if (r === "failed") status = "failed";
    } catch (e) {
      console.error("[bale] status re-check failed:", e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ status, orderNumber: p.order.number }, { headers });
}
