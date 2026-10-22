import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { CustomerOrderActions } from "@/components/orders/customer-order-actions";
import { OrderDetails } from "@/components/orders/order-details";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Alert } from "@/components/ui/alert";
import { LoadingRows } from "@/components/ui/states";
import { expireStaleOrders } from "@/features/orders/service";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "جزئیات سفارش", robots: { index: false } };

const paymentMessages: Record<string, { variant: "success" | "destructive" | "warning"; title: string; body: string }> = {
  paid: { variant: "success", title: "پرداخت با موفقیت انجام شد", body: "سفارش شما ثبت شد و به‌زودی آماده‌سازی می‌شود." },
  failed: { variant: "destructive", title: "پرداخت ناموفق بود", body: "مبلغی از حساب شما کسر نشده است. اگر کسر شده باشد طی ۷۲ ساعت توسط بانک بازمی‌گردد." },
  late_paid_needs_refund: { variant: "warning", title: "پرداخت پس از لغو سفارش انجام شد", body: "متأسفانه موجودی کافی نبود. مبلغ پرداختی به شما بازگردانده می‌شود؛ همکاران ما با شما تماس می‌گیرند." },
  error: { variant: "destructive", title: "بررسی پرداخت با خطا مواجه شد", body: "لطفاً چند دقیقهٔ دیگر وضعیت سفارش را بررسی کنید یا با پشتیبانی تماس بگیرید." },
};

export default function OrderPage({ params, searchParams }: PageProps<"/account/orders/[number]">) {
  return (
    <Suspense fallback={<LoadingRows rows={6} />}>
      <OrderContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function OrderContent({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ number }, sp] = await Promise.all([params, searchParams]);
  const user = await requireUser(`/account/orders/${number}`);
  await expireStaleOrders();
  const order = await db.order.findFirst({
    where: { number: decodeURIComponent(number), userId: user.id }, // scoped to the owner
    include: { items: true, statusHistory: { orderBy: { createdAt: "asc" } }, payments: { where: { status: "SUCCEEDED" }, select: { referenceId: true } } },
  });
  if (!order) notFound();
  const msg = typeof sp.payment === "string" ? paymentMessages[sp.payment] : undefined;

  return (
    <>
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" /> سفارش‌های من
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="ltr text-start text-2xl font-black">{order.number}</h1>
          <p className="text-sm text-muted-foreground">ثبت‌شده در {formatDateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      {msg ? <Alert variant={msg.variant} title={msg.title}>{msg.body}</Alert> : null}
      {order.payments[0]?.referenceId ? <p className="text-sm text-muted-foreground">کد پیگیری پرداخت: <span className="ltr font-semibold text-foreground">{order.payments[0].referenceId}</span></p> : null}
      {order.status === "AWAITING_PAYMENT" && order.paymentDeadline ? (
        <Alert variant="warning" title="در انتظار پرداخت">
          کالاها تا {formatDateTime(order.paymentDeadline)} برای شما رزرو شده‌اند.
          <div className="mt-3"><CustomerOrderActions orderNumber={order.number} /></div>
        </Alert>
      ) : null}
      <OrderDetails order={order} />
    </>
  );
}
