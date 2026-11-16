"use server";

import { revalidatePath } from "next/cache";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { fail, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { getPaymentProvider } from "@/features/payments";
import { openGatewayPayment, TEST_MODE_ERROR } from "@/features/payments/targets";
import { getSectionVisibility } from "@/features/settings/sections";
import { getBookingConfig } from "./config";
import { dateToDay, shiftStart } from "./rules";
import { newBookingSchema } from "./schemas";
import { BookingError, createBooking } from "./service";

async function actor() {
  try {
    return (await assertUser()).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

/** Website booking (login required). Online payment modes send the customer to the gateway. */
export async function bookShift(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  const user = await actor();
  if (!user) return fail("برای رزرو ابتدا وارد حساب کاربری شوید.");
  if (!(await getSectionVisibility()).booking) return fail("رزرو در حال حاضر فعال نیست.");
  if (!(await rateLimit(`booking:${user.id}`, 15, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const parsed = newBookingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است.", zodFieldErrors(parsed.error.issues));
  const [config, provider] = await Promise.all([getBookingConfig(), getPaymentProvider()]);
  const shift = await db.bookingShift.findUnique({ where: { id: parsed.data.shiftId }, select: { paymentMode: true } });
  if (shift && shift.paymentMode !== "ON_SITE" && provider?.testMode && user.role !== "ADMIN") return fail(TEST_MODE_ERROR);
  let created: Awaited<ReturnType<typeof createBooking>>;
  try {
    created = await createBooking(
      { ...parsed.data, guests: config.askGuests ? parsed.data.guests : null },
      { userId: user.id, source: "WEB", providerKey: provider?.key ?? null, window: config, paymentMinutes: config.paymentMinutes, maxGuests: config.maxGuests },
    );
  } catch (e) {
    if (e instanceof BookingError) return fail(e.message);
    throw e;
  }
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "booking.created", entity: "booking", entityId: created.id, ip, meta: { code: created.code } });
  if (!created.paymentId) return ok({ redirectTo: `/account/bookings?new=${encodeURIComponent(created.code)}` }, "رزرو شما ثبت شد.");
  try {
    const redirectTo = await openGatewayPayment(created.paymentId, { amount: created.payNow, description: `رزرو ${created.code} — اتم گیم کلاب`, mobile: parsed.data.phone });
    return ok({ redirectTo });
  } catch (e) {
    console.error("[booking] payment start failed", e);
    await db.$transaction([
      db.payment.update({ where: { id: created.paymentId }, data: { status: "CANCELLED" } }),
      db.booking.update({ where: { id: created.id }, data: { status: "CANCELLED", cancelReason: "خطا در اتصال به درگاه" } }),
    ]);
    return fail("اتصال به درگاه پرداخت ناموفق بود؛ لطفاً دوباره تلاش کنید.");
  }
}

/** The customer cancels an unpaid or pay-at-venue booking before the cut-off; paid ones go through the club. */
export async function cancelMyBooking(code: unknown): Promise<ActionResult<undefined>> {
  const user = await actor();
  if (!user) return fail("ابتدا وارد حساب کاربری شوید.");
  if (typeof code !== "string") return fail("درخواست نامعتبر است.");
  const b = await db.booking.findFirst({ where: { code, userId: user.id } });
  if (!b) return fail("رزرو پیدا نشد.");
  if (b.status !== "AWAITING_PAYMENT" && b.status !== "CONFIRMED") return fail("این رزرو قابل لغو نیست.");
  if (b.paidAmount > BigInt(0)) return fail("این رزرو پرداخت شده است؛ برای لغو و بازگشت وجه با مجموعه تماس بگیرید.");
  const config = await getBookingConfig();
  if (b.status === "CONFIRMED" && shiftStart(dateToDay(b.date), b.startMinute).getTime() - config.minHoursBefore * 3600_000 <= Date.now()) return fail("زمان لغو آنلاین این رزرو گذشته است؛ با مجموعه تماس بگیرید.");
  await db.$transaction([
    db.booking.updateMany({ where: { id: b.id, status: { in: ["AWAITING_PAYMENT", "CONFIRMED"] } }, data: { status: "CANCELLED", cancelReason: "لغو توسط مشتری", paymentDeadline: null } }),
    db.payment.updateMany({ where: { bookingId: b.id, status: "INITIATED" }, data: { status: "CANCELLED" } }),
  ]);
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "booking.cancelled_by_customer", entity: "booking", entityId: b.id, ip });
  revalidatePath("/account/bookings");
  return ok(undefined, "رزرو لغو شد.");
}
