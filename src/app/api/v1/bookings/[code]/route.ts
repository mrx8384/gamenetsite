import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, authenticate, readJson } from "@/features/api/auth";
import { bookingJson } from "@/features/api/booking-view";
import { audit } from "@/lib/audit";
import { BookingError, changeBookingStatus } from "@/features/booking/service";
import { db } from "@/lib/db";

export async function GET(request: NextRequest, { params }: RouteContext<"/api/v1/bookings/[code]">) {
  const auth = await authenticate(request, "booking:read");
  if (auth instanceof Response) return auth;
  const { code } = await params;
  const b = await db.booking.findUnique({ where: { code: code.toUpperCase() } });
  if (!b) return apiError(404, "not_found", "رزرو پیدا نشد.");
  return apiOk(bookingJson(b));
}

const patchSchema = z.object({ status: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]), reason: z.string().trim().max(300).optional() });

/** PATCH { status: "COMPLETED" | "NO_SHOW" | "CANCELLED" | "CONFIRMED", reason? } — same rules as the admin panel. */
export async function PATCH(request: NextRequest, { params }: RouteContext<"/api/v1/bookings/[code]">) {
  const auth = await authenticate(request, "booking:write");
  if (auth instanceof Response) return auth;
  const { code } = await params;
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(422, "validation_error", "status یکی از CONFIRMED, COMPLETED, NO_SHOW, CANCELLED باشد.");
  const b = await db.booking.findUnique({ where: { code: code.toUpperCase() }, select: { id: true } });
  if (!b) return apiError(404, "not_found", "رزرو پیدا نشد.");
  try {
    await changeBookingStatus(b.id, parsed.data.status, parsed.data.reason ?? "تغییر از برنامه");
  } catch (e) {
    if (e instanceof BookingError) return apiError(409, "invalid_transition", e.message);
    throw e;
  }
  await audit({ actorId: null, action: "booking.status_by_api", entity: "booking", entityId: b.id, meta: { to: parsed.data.status, apiKey: auth.keyId } });
  return apiOk(bookingJson(await db.booking.findUniqueOrThrow({ where: { id: b.id } })));
}
