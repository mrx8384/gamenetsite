import type { NextRequest } from "next/server";
import { apiError, apiOk, authenticate, money } from "@/features/api/auth";
import { hhmm } from "@/features/api/booking-view";
import { addDays, dateToDay, dayToDate, daySlots, formatDayLong, isDayKey, tehranDay } from "@/features/booking/rules";
import { takenPlaces } from "@/features/booking/service";
import { db } from "@/lib/db";

/** GET ?from=YYYY-MM-DD&days=7 (max 62). Free places per day and shift (Tehran days). */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request, "booking:read");
  if (auth instanceof Response) return auth;
  const qs = request.nextUrl.searchParams;
  const from = qs.get("from") ?? tehranDay(new Date());
  const days = Number(qs.get("days") ?? "7");
  if (!isDayKey(from)) return apiError(400, "invalid_date", "from باید به شکل YYYY-MM-DD باشد.");
  if (!Number.isInteger(days) || days < 1 || days > 62) return apiError(400, "invalid_days", "days باید بین ۱ تا ۶۲ باشد.");
  const to = addDays(from, days - 1);
  const now = new Date();
  const [shifts, closures, taken] = await Promise.all([
    db.bookingShift.findMany({ where: { isActive: true } }),
    db.bookingClosure.findMany({ where: { date: { gte: dayToDate(from), lte: dayToDate(to) } } }),
    takenPlaces(db, from, to, now),
  ]);
  const closed = new Map(closures.map((c) => [dateToDay(c.date), c.reason]));
  const out = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    return {
      date: day,
      dateFa: formatDayLong(day),
      closed: closed.has(day),
      closedReason: closed.get(day) ?? null,
      shifts: daySlots(day, shifts, { closed: closed.has(day), now, minHoursBefore: 0, taken: (id) => taken.get(`${day}|${id}`) ?? 0 }).map(({ shift, left, taken: t, state }) => ({
        shiftId: shift.id,
        title: shift.title,
        start: hhmm(shift.startMinute),
        end: hhmm(shift.endMinute),
        capacity: shift.capacity,
        taken: t,
        left,
        state,
        price: money(shift.price),
      })),
    };
  });
  return apiOk(out);
}
