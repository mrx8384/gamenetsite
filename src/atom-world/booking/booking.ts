import { BOOKING_URL, isTestPath } from "../config";

/**
 * Booking requests from the 3D world. A request is only a request: the club confirms by phone.
 * Contract: docs/BOOKING.md. Nothing is sent when NEXT_PUBLIC_ATOM_BOOKING_URL is not set.
 */
export interface BookingRequest {
  game: string;
  /** ISO date (yyyy-mm-dd, Gregorian) */
  day: string;
  /** hh:mm, 24 h */
  time: string;
  people: number;
  name: string;
  /** 09xxxxxxxxx */
  phone: string;
  note: string;
}

/** Configured endpoint; with ?debug=1 a same-site `?bookingUrl=/path` can override it (tests). */
function bookingUrl() {
  if (typeof window === "undefined") return BOOKING_URL;
  const q = new URLSearchParams(window.location.search);
  const dbg = q.has("debug") ? q.get("bookingUrl") : null;
  return dbg && isTestPath(dbg) ? dbg : BOOKING_URL;
}

export const bookingEnabled = () => !!bookingUrl();

const latin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** Iranian mobile number → 09xxxxxxxxx, or null. Accepts Persian digits, spaces, +98 / 0098. */
export function normalizeMobile(raw: string): string | null {
  let v = latin(raw).replace(/[\s-]/g, "");
  if (v.startsWith("+98")) v = "0" + v.slice(3);
  else if (v.startsWith("0098")) v = "0" + v.slice(4);
  else if (v.startsWith("98") && v.length === 12) v = "0" + v.slice(2);
  return /^09\d{9}$/.test(v) ? v : null;
}

/** The next `n` days with their Persian (Jalali) labels: «امروز — شنبه ۳ آبان». */
export function nextDays(n = 7, from = new Date()) {
  const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" });
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const label = fmt.format(d);
    return { iso, label: i === 0 ? `امروز — ${label}` : i === 1 ? `فردا — ${label}` : label };
  });
}

export type BookingErrors = Partial<Record<keyof BookingRequest, string>>;

export function validateBooking(r: BookingRequest): BookingErrors {
  const e: BookingErrors = {};
  if (!r.game) e.game = "بازی را انتخاب کنید.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.day)) e.day = "روز را انتخاب کنید.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time)) e.time = "ساعت را وارد کنید.";
  if (!(r.people >= 1 && r.people <= 20)) e.people = "تعداد نفرات بین ۱ تا ۲۰ است.";
  if (r.name.trim().length < 2) e.name = "نام را وارد کنید.";
  if (!normalizeMobile(r.phone)) e.phone = "شمارهٔ موبایل معتبر نیست (مثلاً ۰۹۱۲۳۴۵۶۷۸۹).";
  if (r.note.length > 300) e.note = "توضیح حداکثر ۳۰۰ حرف است.";
  return e;
}

export async function sendBooking(r: BookingRequest): Promise<boolean> {
  const url = bookingUrl();
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ version: 1, ...r, name: r.name.trim().slice(0, 40), phone: normalizeMobile(r.phone), note: r.note.trim().slice(0, 300) }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
