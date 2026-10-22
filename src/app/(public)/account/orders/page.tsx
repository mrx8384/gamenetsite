import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { expireStaleOrders } from "@/features/orders/service";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDate, formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "سفارش‌های من", robots: { index: false } };

export default function MyOrdersPage() {
  return (
    <>
      <h1 className="text-2xl font-black">سفارش‌های من</h1>
      <Suspense fallback={<LoadingRows rows={4} />}>
        <OrdersList />
      </Suspense>
    </>
  );
}

async function OrdersList() {
  const user = await requireUser("/account/orders");
  await expireStaleOrders();
  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, number: true, status: true, total: true, createdAt: true, _count: { select: { items: true } } },
  });
  if (orders.length === 0) {
    return <EmptyState icon={Package} title="هنوز سفارشی ثبت نکرده‌اید" action={<Button asChild><Link href="/shop">رفتن به فروشگاه</Link></Button>} />;
  }
  return (
    <ul className="divide-y rounded-xl border bg-surface">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-secondary/50">
            <div className="space-y-1">
              <p className="ltr text-start font-bold">{o.number}</p>
              <p className="text-xs text-muted-foreground">{formatDate(o.createdAt)} · {formatNumber(o._count.items)} قلم کالا</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{formatToman(o.total)}</span>
              <OrderStatusBadge status={o.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
