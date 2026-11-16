import "server-only";
import type { Booking } from "@/generated/prisma/client";
import { money } from "./auth";
import { dateToDay, formatDayLong, formatMinute } from "@/features/booking/rules";

const hhmm = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Public API shape of a booking (dates: Tehran day "YYYY-MM-DD", times "HH:mm"). */
export function bookingJson(b: Booking) {
  return {
    code: b.code,
    status: b.status,
    date: dateToDay(b.date),
    dateFa: formatDayLong(dateToDay(b.date)),
    shiftId: b.shiftId,
    shiftTitle: b.shiftTitle,
    start: hhmm(b.startMinute),
    end: hhmm(b.endMinute),
    endsNextDay: b.endMinute > 1440,
    startFa: formatMinute(b.startMinute),
    name: b.name,
    phone: b.phone,
    guests: b.guests,
    note: b.note,
    price: money(b.price),
    discount: money(b.discount),
    total: money(b.total),
    paidOnline: money(b.paidAmount),
    paymentMode: b.paymentMode,
    refundStatus: b.refundStatus,
    source: b.source,
    createdAt: b.createdAt.toISOString(),
  };
}
export { hhmm };
