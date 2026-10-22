import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Receipt, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ORDER_STATUS_LABEL, type OrderStatusKey } from "@/features/orders/schemas";
import { expireStaleOrders } from "@/features/orders/service";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatNumber, formatToman, toEnglishDigits } from "@/lib/format";

export const metadata: Metadata = { title: "سفارش‌ها" };
const PAGE_SIZE = 25;
type SP = { q?: string; status?: string; page?: string };

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <>
      <AdminPageHeader title="سفارش‌ها" description="پیگیری، آماده‌سازی و ارسال سفارش‌ها." />
      <Suspense fallback={<LoadingRows rows={8} />}>
        <OrdersTable searchParams={searchParams as Promise<SP>} />
      </Suspense>
    </>
  );
}

async function OrdersTable({ searchParams }: { searchParams: Promise<SP> }) {
  await requireRole(["ADMIN"], "/admin/orders");
  await expireStaleOrders();
  const sp = await searchParams;
  const q = toEnglishDigits(String(sp.q ?? "")).trim().slice(0, 50);
  const status = (Object.keys(ORDER_STATUS_LABEL) as OrderStatusKey[]).find((s) => s === sp.status);
  const page = Math.max(1, Number.parseInt(String(sp.page ?? "1"), 10) || 1);
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ number: { contains: q.toUpperCase() } }, { phone: { contains: q } }, { recipientName: { contains: q, mode: "insensitive" } }, { user: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };
  const [total, orders, counts] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, number: true, status: true, total: true, createdAt: true, recipientName: true, phone: true, user: { select: { name: true } } },
    }),
    db.order.groupBy({ by: ["status"], _count: true }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const countOf = (s: OrderStatusKey) => counts.find((c) => c.status === s)?._count ?? 0;
  const qs = (p: number, st = status) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (st) params.set("status", st);
    if (p > 1) params.set("page", String(p));
    return `/admin/orders?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["PAID", "PROCESSING", "AWAITING_PAYMENT", "SHIPPED"] as const).map((s) => (
          <Link key={s} href={qs(1, s)} className="rounded-full border bg-surface px-3 py-1.5 text-sm hover:bg-secondary">
            {ORDER_STATUS_LABEL[s]} <span className="text-muted-foreground">({formatNumber(countOf(s))})</span>
          </Link>
        ))}
      </div>
      <form className="grid gap-3 rounded-xl border bg-surface p-4 sm:grid-cols-[1fr_200px_auto]" role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={q} placeholder="شماره سفارش، موبایل یا نام" className="ps-9" aria-label="جست‌وجو" />
        </div>
        <NativeSelect name="status" defaultValue={status ?? ""} aria-label="وضعیت">
          <option value="">همهٔ وضعیت‌ها</option>
          {(Object.keys(ORDER_STATUS_LABEL) as OrderStatusKey[]).map((s) => <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>)}
        </NativeSelect>
        <Button type="submit" variant="strong">اعمال فیلتر</Button>
      </form>
      <p className="text-sm text-muted-foreground">{formatNumber(total)} سفارش</p>
      {orders.length === 0 ? (
        <EmptyState icon={Receipt} title="سفارشی پیدا نشد" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>شماره</TableHead>
              <TableHead>مشتری</TableHead>
              <TableHead>تاریخ</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>وضعیت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell><Link href={`/admin/orders/${o.id}`} className="ltr font-semibold text-link hover:underline">{o.number}</Link></TableCell>
                <TableCell>
                  <p>{o.recipientName}</p>
                  <p className="ltr text-start text-xs text-muted-foreground">{o.phone}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap">{formatToman(o.total)}</TableCell>
                <TableCell><OrderStatusBadge status={o.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {pages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">صفحهٔ {formatNumber(page)} از {formatNumber(pages)}</span>
          <div className="flex gap-2">
            {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={qs(page - 1)}>قبلی</Link></Button> : null}
            {page < pages ? <Button asChild variant="outline" size="sm"><Link href={qs(page + 1)}>بعدی</Link></Button> : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
