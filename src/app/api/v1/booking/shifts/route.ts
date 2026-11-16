import type { NextRequest } from "next/server";
import { apiOk, authenticate, money } from "@/features/api/auth";
import { hhmm } from "@/features/api/booking-view";
import { db } from "@/lib/db";

/** Shift definitions (weekdays: 0 = شنبه … 6 = جمعه). */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request, "booking:read");
  if (auth instanceof Response) return auth;
  const shifts = await db.bookingShift.findMany({ orderBy: [{ sortOrder: "asc" }, { startMinute: "asc" }] });
  return apiOk(
    shifts.map((s) => ({ id: s.id, title: s.title, weekdays: s.weekdays, start: hhmm(s.startMinute), end: hhmm(s.endMinute), endsNextDay: s.endMinute > 1440, capacity: s.capacity, price: money(s.price), paymentMode: s.paymentMode, depositPercent: s.depositPercent, description: s.description, active: s.isActive })),
  );
}
