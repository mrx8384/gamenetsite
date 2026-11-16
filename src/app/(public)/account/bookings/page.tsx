import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { CancelBookingButton } from "@/components/booking/cancel-booking-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { BOOKING_STATUS_LABELS, dateToDay, formatDayLong, shiftRange } from "@/features/booking/rules";
import { getSiteSettings } from "@/features/settings/site";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "رزروهای من", robots: { index: false } };

const NOTICE: Record<string, { variant: "success" | "destructive" | "warning"; text: string }> = {
  paid: { variant: "success", text: "پرداخت انجام شد و رزرو شما قطعی شد." },
  failed: { variant: "destructive", text: "پرداخت انجام نشد و رزرو ثبت نشد. اگر مبلغی کم شده، تا ۷۲ ساعت برمی‌گردد؛ می‌توانید دوباره رزرو کنید." },
  late_paid_needs_refund: { variant: "warning", text: "پرداخت بعد از پایان مهلت انجام شد و شیفت دیگر خالی نبود؛ مبلغ توسط اتم گیم کلاب بازگردانده می‌شود." },
  error: { variant: "warning", text: "نتیجهٔ پرداخت هنوز مشخص نیست؛ چند دقیقه بعد همین صفحه را ببینید یا با پشتیبانی تماس بگیرید." },
};

const BADGE = { AWAITING_PAYMENT: "warning", CONFIRMED: "success", COMPLETED: "secondary", NO_SHOW: "outline", CANCELLED: "outline" } as const;

export default function MyBookingsPage({ searchParams }: PageProps<"/account/bookings">) {
  return (
    <>
      <h1 className="text-2xl font-black">رزروهای من</h1>
      <Suspense fallback={<LoadingRows rows={4} />}>
        <List searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: PageProps<"/account/bookings">["searchParams"] }) {
  const user = await requireUser("/account/bookings");
  const sp = await searchParams;
  const notice = NOTICE[String(sp.payment ?? "")];
  const fresh = typeof sp.new === "string" ? sp.new : null;
  const [bookings, texts] = await Promise.all([
    db.booking.findMany({ where: { userId: user.id }, orderBy: [{ date: "desc" }, { startMinute: "desc" }], take: 50 }),
    getSiteSettings("booking"),
  ]);
  return (
    <div className="space-y-4">
      {notice ? <Alert variant={notice.variant}>{notice.text}</Alert> : null}
      {fresh ? <Alert variant="success">{texts.successText} <span className="ltr font-mono font-bold" dir="ltr">{fresh}</span></Alert> : null}
      {bookings.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="هنوز رزروی ندارید" action={<Button asChild><Link href="/booking">رزرو شیفت</Link></Button>} />
      ) : (
        <ul className="grid gap-3">
          {bookings.map((b) => (
            <li key={b.id} className="space-y-2 rounded-xl border bg-surface p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{b.shiftTitle} — {formatDayLong(dateToDay(b.date))}</p>
                <Badge variant={BADGE[b.status]}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
              </div>
              <p className="text-muted-foreground">{shiftRange(b.startMinute, b.endMinute)} · کد رزرو <span className="ltr font-mono font-semibold text-foreground" dir="ltr">{b.code}</span></p>
              <p>
                مبلغ: {formatToman(b.total)}
                {b.discount > BigInt(0) ? <span className="text-success"> (با {formatToman(b.discount)} تخفیف)</span> : null}
                {b.paidAmount > BigInt(0) ? <span> · پرداخت‌شده: {formatToman(b.paidAmount)}</span> : null}
                {b.status === "CONFIRMED" && b.total > b.paidAmount ? <span className="text-muted-foreground"> · باقی‌مانده حضوری: {formatToman(b.total - b.paidAmount)}</span> : null}
              </p>
              {b.status === "AWAITING_PAYMENT" && b.paymentDeadline ? <p className="text-xs text-warning">تا پایان مهلت پرداخت، شیفت برای شما نگه داشته می‌شود.</p> : null}
              {b.refundStatus === "NEEDED" ? <p className="text-xs text-warning">مبلغ پرداختی شما برگردانده می‌شود.</p> : b.refundStatus === "DONE" ? <p className="text-xs text-success">مبلغ پرداختی برگردانده شد.</p> : null}
              {b.cancelReason && b.status === "CANCELLED" ? <p className="text-xs text-muted-foreground">علت لغو: {b.cancelReason}</p> : null}
              {(b.status === "CONFIRMED" || b.status === "AWAITING_PAYMENT") && b.paidAmount === BigInt(0) ? <CancelBookingButton code={b.code} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
