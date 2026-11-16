import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Clock, Pencil, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ShiftDialog } from "@/components/admin/booking/shift-dialog";
import { toShiftForm } from "@/components/admin/booking/shift-form-data";
import { BookingConfigForm, ClosuresForm } from "@/components/admin/booking/setup-forms";
import { DeleteButton } from "@/components/admin/store/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteShift } from "@/features/booking/admin-actions";
import { getBookingConfig } from "@/features/booking/config";
import { dateToDay, dayToDate, formatDayLong, PAYMENT_MODE_LABELS, shiftRange, tehranDay, WEEKDAY_LABELS, type PaymentMode } from "@/features/booking/rules";
import { getPaymentProvider } from "@/features/payments";
import { requireRole } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "شیفت‌ها و تنظیمات رزرو" };

export default function BookingSetupPage() {
  return (
    <>
      <Link href="/admin/booking" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> رزروها</Link>
      <AdminPageHeader title="شیفت‌ها و تنظیمات رزرو" description="شیفت‌بندی مجموعه برای هر روز هفته، قیمت و نحوهٔ پرداخت هر شیفت، روزهای تعطیل. متن‌های صفحهٔ رزرو در «تنظیمات سایت ← رزرو»." />
      <Suspense fallback={<LoadingRows rows={5} />}>
        <Setup />
      </Suspense>
    </>
  );
}

const weekdaysText = (w: number[]) => (w.length === 7 ? "همهٔ روزها" : w.map((d) => WEEKDAY_LABELS[d]).join("، "));

async function Setup() {
  await requireRole(["ADMIN"], "/admin/booking/setup");
  const [shifts, closures, config, provider] = await Promise.all([
    db.bookingShift.findMany({ orderBy: [{ sortOrder: "asc" }, { startMinute: "asc" }], include: { _count: { select: { bookings: true } } } }),
    db.bookingClosure.findMany({ where: { date: { gte: dayToDate(tehranDay(new Date())) } }, orderBy: { date: "asc" } }),
    getBookingConfig(),
    getPaymentProvider(),
  ]);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="size-4" /> شیفت‌ها</CardTitle>
          <ShiftDialog onlineReady={provider !== null} trigger={<Button size="sm"><Plus /> شیفت جدید</Button>} />
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <EmptyState icon={Clock} title="هنوز شیفتی تعریف نشده" description="مثلاً «صبح ۱۰ تا ۱۴»، «عصر ۱۴ تا ۱۸»، «شب ۱۸ تا ۲۴» بسازید؛ برای هر شیفت روزهای هفته، قیمت و نحوهٔ پرداخت را تعیین کنید." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>شیفت</TableHead>
                  <TableHead>روزها</TableHead>
                  <TableHead>قیمت و پرداخت</TableHead>
                  <TableHead>ظرفیت</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead className="w-24"><span className="sr-only">عملیات</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{shiftRange(s.startMinute, s.endMinute)}</p>
                    </TableCell>
                    <TableCell className="text-xs">{weekdaysText(s.weekdays)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {s.price === BigInt(0) ? "رایگان" : formatToman(s.price)}
                      <p className="text-xs text-muted-foreground">{PAYMENT_MODE_LABELS[s.paymentMode as PaymentMode] ?? s.paymentMode}{s.paymentMode === "DEPOSIT" && s.depositPercent ? ` ${formatNumber(s.depositPercent)}٪` : ""}</p>
                    </TableCell>
                    <TableCell>{s.capacity === 1 ? "کل مجموعه" : formatNumber(s.capacity)}</TableCell>
                    <TableCell>{s.isActive ? <Badge variant="success">فعال</Badge> : <Badge variant="outline">غیرفعال</Badge>}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <ShiftDialog onlineReady={provider !== null} initial={toShiftForm({ ...s, price: s.price.toString() })} trigger={<Button variant="ghost" size="icon-sm" aria-label={`ویرایش ${s.title}`}><Pencil /></Button>} />
                        <DeleteButton title={`حذف «${s.title}»؟`} description={s._count.bookings ? "این شیفت رزرو دارد؛ فقط غیرفعال می‌شود." : "شیفت حذف می‌شود."} action={deleteShift.bind(null, s.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">روزهای تعطیل</CardTitle></CardHeader>
        <CardContent><ClosuresForm closures={closures.map((c) => ({ id: c.id, label: formatDayLong(dateToDay(c.date)), reason: c.reason }))} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">تنظیمات رزرو</CardTitle></CardHeader>
        <CardContent><BookingConfigForm initial={config} /></CardContent>
      </Card>
    </div>
  );
}
