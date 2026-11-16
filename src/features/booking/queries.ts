import "server-only";
import { db } from "@/lib/db";
import { getBookingConfig } from "./config";
import { addDays, bookableDays, dateToDay, dayToDate, daySlots } from "./rules";
import { takenPlaces } from "./service";

export interface PublicSlot {
  shiftId: string;
  title: string;
  description: string | null;
  startMinute: number;
  endMinute: number;
  price: string;
  paymentMode: string;
  depositPercent: number | null;
  left: number;
  capacity: number;
  state: "open" | "full" | "closed" | "past";
}

/** Request-time availability for the booking page (never cached: it changes with every booking). */
export async function getBookingCalendar(now = new Date()) {
  const config = await getBookingConfig();
  const days = bookableDays(now, config.daysAhead);
  const from = days[0];
  const to = days[days.length - 1];
  const [shifts, closures, taken] = await Promise.all([
    db.bookingShift.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { startMinute: "asc" }] }),
    db.bookingClosure.findMany({ where: { date: { gte: dayToDate(from), lte: dayToDate(addDays(to, 0)) } } }),
    takenPlaces(db, from, to, now),
  ]);
  const closed = new Map(closures.map((c) => [dateToDay(c.date), c.reason]));
  const calendar = days.map((day) => {
    const slots: PublicSlot[] = daySlots(day, shifts, { closed: closed.has(day), now, minHoursBefore: config.minHoursBefore, taken: (id) => taken.get(`${day}|${id}`) ?? 0 }).map(({ shift, left, state }) => ({
      shiftId: shift.id,
      title: shift.title,
      description: shift.description,
      startMinute: shift.startMinute,
      endMinute: shift.endMinute,
      price: shift.price.toString(),
      paymentMode: shift.paymentMode,
      depositPercent: shift.depositPercent,
      left,
      capacity: shift.capacity,
      state,
    }));
    return { day, closedReason: closed.has(day) ? (closed.get(day) ?? "") : null, slots };
  });
  return { config, calendar, hasShifts: shifts.length > 0 };
}
