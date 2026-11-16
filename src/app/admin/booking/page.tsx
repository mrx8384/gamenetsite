import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarCheck, Plus, Settings2 } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { BookingActions } from "@/components/admin/booking/booking-actions";
import { ManualBookingDialog } from "@/components/admin/booking/manual-booking-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { BOOKING_STATUS_LABELS, dateToDay, dayToDate, formatDayLong, shiftRange, tehranDay } from "@/features/booking/rules";
import { allowedTransitions, expireStaleBookings } from "@/features/booking/service";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatToman, toPersianDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "رزروها" };

const VIEWS = [
  { key: "upcoming", label: "پیش رو" },
  { key: "today", label: "امروز" },
  { key: "refunds", label: "بازگشت وجه" },
  { key: "past", label: "گذشته" },
  { key: "cancelled", label: "لغو شده" },
] as const;
type View = (typeof VIEWS)[number]["key"];

const BADGE = { AWAITING_PAYMENT: "warning", CONFIRMED: "success", COMPLETED: "secondary", NO_SHOW: "outline", CANCELLED: "outline" } as const;
const SOURCE = { WEB: "سایت", ADMIN: "دستی", API: "برنامه" } as const;

export default function AdminBookingPage({ searchParams }: PageProps<"/admin/booking">) {
  return (
    <>
      <AdminPageHeader
        title="رزروها"
        description="رزرو شیفت‌های مجموعه؛ شیفت‌ها، قیمت‌ها، روزهای تعطیل و نحوهٔ پرداخت در «شیفت‌ها و تنظیمات»."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href="/admin/booking/setup"><Settings2 /> شیفت‌ها و تنظیمات</Link></Button>
            <Suspense fallback={null}><ManualButton /></Suspense>
          </div>
        }
      />
      <Suspense fallback={<LoadingRows rows={5} />}>
        <BookingList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ManualButton() {
  await requireRole(["ADMIN"], "/admin/booking");
  const shifts = await db.bookingShift.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { startMinute: "asc" }], select: { id: true, title: true, weekdays: true, startMinute: true, endMinute: true } });
  return <ManualBookingDialog shifts={shifts} trigger={<Button><Plus /> رزرو دستی</Button>} />;
}

async function BookingList({ searchParams }: { searchParams: PageProps<"/admin/booking">["searchParams"] }) {
  await requireRole(["ADMIN"], "/admin/booking");
  await expireStaleBookings();
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.view) ? (sp.view as View) : "upcoming";
  const today = dayToDate(tehranDay(new Date()));
  const where: Prisma.BookingWhereInput =
    view === "today" ? { date: today, status: { not: "CANCELLED" } }
    : view === "refunds" ? { refundStatus: "NEEDED" }
    : view === "past" ? { date: { lt: today }, status: { not: "CANCELLED" } }
    : view === "cancelled" ? { status: "CANCELLED" }
    : { date: { gte: today }, status: { in: ["CONFIRMED", "AWAITING_PAYMENT"] } };
  const [rows, refundCount] = await Promise.all([
    db.booking.findMany({ where, orderBy: view === "past" || view === "cancelled" ? [{ date: "desc" }, { startMinute: "desc" }] : [{ date: "asc" }, { startMinute: "asc" }], take: 200, include: { discountRedemption: { select: { code: { select: { code: true } } } } } }),
    db.booking.count({ where: { refundStatus: "NEEDED" } }),
  ]);
  return (
    <div className="space-y-4">
      <nav aria-label="فیلتر رزروها" className="flex gap-1 overflow-x-auto border-b">
        {VIEWS.map((v) => (
          <Link key={v.key} href={`/admin/booking?view=${v.key}`} aria-current={view === v.key ? "page" : undefined} className={cn("shrink-0 border-b-2 px-3 py-2 text-sm", view === v.key ? "border-brand-green-dark font-bold" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {v.label}{v.key === "refunds" && refundCount ? ` (${formatNumber(refundCount)})` : ""}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="رزروی در این فهرست نیست" description={view === "upcoming" ? "رزروهای سایت، برنامه و رزروهای دستی این‌جا نمایش داده می‌شوند." : undefined} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>زمان</TableHead>
              <TableHead>مشتری</TableHead>
              <TableHead>مبلغ</TableHead>
              <TableHead>وضعیت</TableHead>
              <TableHead className="min-w-64">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="align-top">
                  <p className="font-semibold">{formatDayLong(dateToDay(b.date))}</p>
                  <p className="text-xs text-muted-foreground">{b.shiftTitle} · {shiftRange(b.startMinute, b.endMinute)}</p>
                  <p className="ltr font-mono text-xs" dir="ltr">{b.code}</p>
                </TableCell>
                <TableCell className="align-top">
                  <p className="font-medium">{b.name}</p>
                  <a href={`tel:${b.phone}`} className="ltr text-xs text-link" dir="ltr">{toPersianDigits(b.phone)}</a>
                  {b.guests ? <p className="text-xs text-muted-foreground">{formatNumber(b.guests)} نفر</p> : null}
                  {b.note ? <p className="max-w-56 text-xs leading-5 text-muted-foreground">{b.note}</p> : null}
                  <p className="text-[11px] text-muted-foreground">ثبت از {SOURCE[b.source as keyof typeof SOURCE] ?? b.source}</p>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap text-sm">
                  <p>{formatToman(b.total)}</p>
                  {b.discount > BigInt(0) ? <p className="text-xs text-success">تخفیف {formatToman(b.discount)}{b.discountRedemption ? ` (${b.discountRedemption.code.code})` : ""}</p> : null}
                  <p className="text-xs text-muted-foreground">{b.paidAmount > BigInt(0) ? `آنلاین: ${formatToman(b.paidAmount)}` : "پرداخت حضوری"}</p>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant={BADGE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                  {b.refundStatus === "NEEDED" ? <p className="mt-1 text-xs font-bold text-warning">بازگشت {formatToman(b.paidAmount)}</p> : b.refundStatus === "DONE" ? <p className="mt-1 text-xs text-success">وجه برگردانده شد</p> : null}
                  {b.cancelReason && b.status === "CANCELLED" ? <p className="mt-1 max-w-40 text-xs text-muted-foreground">{b.cancelReason}</p> : null}
                </TableCell>
                <TableCell className="align-top">
                  <BookingActions id={b.id} allowed={allowedTransitions(b.status)} refundNeeded={b.refundStatus === "NEEDED"} note={b.adminNote ?? ""} paid={b.paidAmount > BigInt(0)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
