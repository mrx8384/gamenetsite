/**
 * Venue booking by shift — pure rules (unit-tested). Days are Tehran calendar days written "YYYY-MM-DD";
 * Iran has a fixed +03:30 offset (no DST since 2022).
 */
import { MIN_ONLINE_PAYMENT } from "@/features/discounts/rules";

export const WEEKDAY_LABELS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"] as const;

export const PAYMENT_MODES = ["ONLINE_FULL", "DEPOSIT", "ON_SITE"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  ONLINE_FULL: "پرداخت کامل آنلاین",
  DEPOSIT: "بیعانهٔ آنلاین، بقیه حضوری",
  ON_SITE: "پرداخت حضوری",
};

export const BOOKING_STATUS_LABELS = {
  AWAITING_PAYMENT: "در انتظار پرداخت",
  CONFIRMED: "قطعی",
  COMPLETED: "انجام شد",
  NO_SHOW: "نیامد",
  CANCELLED: "لغو شده",
} as const;
export type BookingStatusKey = keyof typeof BOOKING_STATUS_LABELS;

/** Statuses that hold a place (an unpaid booking holds it only until its payment deadline). */
export const HOLDING_STATUSES = ["CONFIRMED", "COMPLETED", "NO_SHOW"] as const;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const isDayKey = (s: string) => DAY_RE.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

/** Tehran calendar day of an instant. */
export function tehranDay(at: Date): string {
  return new Date(at.getTime() + 3.5 * 3600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = شنبه … 6 = جمعه. */
export function persianWeekday(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 1) % 7;
}

/** The DB value (@db.Date) of a day. */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00Z`);
export const dateToDay = (d: Date) => d.toISOString().slice(0, 10);

/** Instant a shift starts on a day. */
export function shiftStart(day: string, startMinute: number): Date {
  return new Date(new Date(`${day}T00:00:00+03:30`).getTime() + startMinute * 60_000);
}

/** "18:30" (Persian digits), minutes past 24:00 shown as next-day time. */
export function formatMinute(m: number): string {
  const v = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function shiftRange(startMinute: number, endMinute: number): string {
  return `${formatMinute(startMinute)} تا ${formatMinute(endMinute)}${endMinute > 1440 ? " (بامداد روز بعد)" : ""}`;
}

/** "HH:mm" → minutes; `allowNextDay` accepts times after midnight as 24:00+ (e.g. "02:00" → 1560). */
export function parseTime(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim().replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** End before or equal to start means "after midnight": 18:00 → 02:00 = 1080 → 1560. Max 06:00 next day. */
export function normalizeEnd(start: number, end: number): number | null {
  const e = end <= start ? end + 1440 : end;
  if (e - start < 30) return null;
  if (e > 1440 + 360) return null;
  return e;
}

/** Amount charged online for a booking total. */
export function amountToPayNow(total: bigint, mode: string, depositPercent: number | null): bigint {
  if (total <= BigInt(0) || mode === "ON_SITE") return BigInt(0);
  if (mode === "ONLINE_FULL") return total;
  const pct = BigInt(Math.min(100, Math.max(1, depositPercent ?? 30)));
  let d = ((total * pct) / BigInt(100) / BigInt(10)) * BigInt(10);
  if (d < MIN_ONLINE_PAYMENT) d = MIN_ONLINE_PAYMENT;
  return d > total ? total : d;
}

export interface ShiftDef {
  id: string;
  title: string;
  weekdays: number[];
  startMinute: number;
  endMinute: number;
  capacity: number;
  isActive: boolean;
}

export type SlotState = "open" | "full" | "closed" | "past";

/**
 * Shifts offered on a day with their state. `taken(shiftId)` = places held on that day.
 * Past = starts in less than `minHoursBefore`.
 */
export function daySlots<T extends ShiftDef>(day: string, shifts: T[], ctx: { closed: boolean; now: Date; minHoursBefore: number; taken: (shiftId: string) => number }) {
  const wd = persianWeekday(day);
  return shifts
    .filter((s) => s.isActive && s.weekdays.includes(wd))
    .sort((a, b) => a.startMinute - b.startMinute)
    .map((s) => {
      const taken = ctx.taken(s.id);
      const left = Math.max(0, s.capacity - taken);
      const state: SlotState = ctx.closed
        ? "closed"
        : shiftStart(day, s.startMinute).getTime() - ctx.minHoursBefore * 3600_000 <= ctx.now.getTime()
          ? "past"
          : left === 0
            ? "full"
            : "open";
      return { shift: s, taken, left, state };
    });
}

/** Days a customer may pick: today … today + daysAhead - 1 (Tehran). */
export function bookableDays(now: Date, daysAhead: number): string[] {
  const first = tehranDay(now);
  return Array.from({ length: Math.max(1, daysAhead) }, (_, i) => addDays(first, i));
}

/** Customer-facing tracking code, e.g. BK-482130. */
export function makeBookingCode(random: () => number = Math.random): string {
  return `BK-${String(Math.floor(random() * 900_000) + 100_000)}`;
}

/** { weekday: "شنبه", date: "۲۵ آبان" } for a day key (Jalali). */
export function dayLabel(day: string): { weekday: string; date: string } {
  const d = new Date(`${day}T12:00:00Z`);
  return {
    weekday: WEEKDAY_LABELS[persianWeekday(day)],
    date: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", day: "numeric", month: "long" }).format(d),
  };
}

/** "شنبه ۲۵ آبان ۱۴۰۵" */
export function formatDayLong(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAY_LABELS[persianWeekday(day)]} ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(d)}`;
}
