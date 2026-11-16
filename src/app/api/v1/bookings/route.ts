import type { NextRequest } from "next/server";
import type { BookingStatus } from "@/generated/prisma/client";
import { apiError, apiOk, authenticate, readJson } from "@/features/api/auth";
import { bookingJson } from "@/features/api/booking-view";
import { audit } from "@/lib/audit";
import { getBookingConfig } from "@/features/booking/config";
import { addDays, dayToDate, isDayKey, tehranDay } from "@/features/booking/rules";
import { newBookingSchema } from "@/features/booking/schemas";
import { BookingError, createBooking, expireStaleBookings } from "@/features/booking/service";
import { db } from "@/lib/db";

const STATUSES = ["AWAITING_PAYMENT", "CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"];

/** GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&status=CONFIRMED (default: today … +30 days, max 200 rows). */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request, "booking:read");
  if (auth instanceof Response) return auth;
  await expireStaleBookings();
  const qs = request.nextUrl.searchParams;
  const from = qs.get("from") ?? tehranDay(new Date());
  const to = qs.get("to") ?? addDays(from, 30);
  const status = qs.get("status");
  if (!isDayKey(from) || !isDayKey(to) || to < from) return apiError(400, "invalid_date", "from و to باید به شکل YYYY-MM-DD باشند.");
  if (status && !STATUSES.includes(status)) return apiError(400, "invalid_status", `status یکی از ${STATUSES.join(", ")} باشد.`);
  const rows = await db.booking.findMany({
    where: { date: { gte: dayToDate(from), lte: dayToDate(to) }, ...(status ? { status: status as BookingStatus } : {}) },
    orderBy: [{ date: "asc" }, { startMinute: "asc" }],
    take: 200,
  });
  return apiOk(rows.map(bookingJson));
}

/**
 * POST { date, shiftId, name, phone, guests?, note?, discountCode? } → confirmed booking, paid at the venue.
 * Same capacity, closure and discount rules as the website.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticate(request, "booking:write");
  if (auth instanceof Response) return auth;
  const body = await readJson(request);
  if (body === null) return apiError(400, "invalid_json", "بدنهٔ درخواست باید JSON معتبر باشد.");
  const parsed = newBookingSchema.safeParse(body);
  if (!parsed.success) return apiError(422, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | "));
  const config = await getBookingConfig();
  try {
    const created = await createBooking(parsed.data, { userId: null, source: "API", providerKey: null, paymentMinutes: config.paymentMinutes, maxGuests: config.maxGuests });
    await audit({ actorId: null, action: "booking.created_by_api", entity: "booking", entityId: created.id, meta: { code: created.code, apiKey: auth.keyId } });
    const b = await db.booking.findUniqueOrThrow({ where: { id: created.id } });
    return apiOk(bookingJson(b), 201);
  } catch (e) {
    if (e instanceof BookingError) return apiError(409, "booking_rejected", e.message);
    throw e;
  }
}
