import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { OrderAdminPanel } from "@/components/admin/orders/order-admin-panel";
import { OrderDetails } from "@/components/orders/order-details";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingRows } from "@/components/ui/states";
import { ADMIN_TRANSITIONS } from "@/features/orders/schemas";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatToman, toPersianDigits } from "@/lib/format";

export const metadata: Metadata = { title: "جزئیات سفارش" };
const paymentStatus = { INITIATED: ["در انتظار", "secondary"], SUCCEEDED: ["موفق", "success"], FAILED: ["ناموفق", "destructive"], CANCELLED: ["لغو", "outline"] } as const;

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<LoadingRows rows={8} />}>
      <AdminOrder params={params} />
    </Suspense>
  );
}

async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireRole(["ADMIN"], `/admin/orders/${id}`);
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      user: { select: { name: true, email: true, phone: true } },
    },
  });
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="size-4" /> سفارش‌ها</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ltr text-start text-2xl font-black">{order.number}</h1>
          <p className="text-sm text-muted-foreground">ثبت در {formatDateTime(order.createdAt)} · مشتری: {order.user.name} {order.user.phone ? <span className="ltr">({toPersianDigits(order.user.phone)})</span> : null}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      {order.adminNote?.includes("بازپرداخت") ? <Alert variant="warning" title="نیاز به اقدام">{order.adminNote}</Alert> : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <OrderDetails order={order} stacked />
        <div className="space-y-6">
          <OrderAdminPanel orderId={order.id} transitions={ADMIN_TRANSITIONS[order.status]} adminNote={order.adminNote ?? ""} />
          <Card>
            <CardHeader><CardTitle className="text-base">پرداخت‌ها</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {order.payments.length === 0 ? <p className="text-muted-foreground">پرداختی ثبت نشده است.</p> : order.payments.map((p) => (
                <div key={p.id} className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span>{formatToman(p.amount)}</span>
                    <Badge variant={paymentStatus[p.status][1]}>{paymentStatus[p.status][0]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.provider} · {formatDateTime(p.createdAt)}</p>
                  {p.referenceId ? <p className="ltr text-start text-xs">Ref: {p.referenceId}{p.cardPanMasked ? ` · ${p.cardPanMasked}` : ""}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
