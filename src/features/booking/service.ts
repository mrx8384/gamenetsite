import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { capForGateway } from "@/features/discounts/rules";
import { DiscountError, lockDiscount, recordRedemption } from "@/features/discounts/service";
import { amountToPayNow, dateToDay, dayToDate, HOLDING_STATUSES, makeBookingCode, persianWeekday, shiftStart, tehranDay, addDays, type BookingStatusKey } from "./rules";
import type { NewBookingInput } from "./schemas";

type Tx = Prisma.TransactionClient;
type Result = { ok: true; referenceId: string; cardPanMasked?: string; raw?: unknown } | { ok: false; reason: string; raw?: unknown };

export class BookingError extends Error {}

/** Places held per day+shift between two days (inclusive). Key: "YYYY-MM-DD|shiftId". */
export async function takenPlaces(client: Tx | typeof db, from: string, to: string, now = new Date(), exceptId?: string): Promise<Map<string, number>> {
  const rows = await client.booking.groupBy({
    by: ["date", "shiftId"],
    where: {
      date: { gte: dayToDate(from), lte: dayToDate(to) },
      shiftId: { not: null },
      ...(exceptId ? { id: { not: exceptId } } : {}),
      OR: [{ status: { in: [...HOLDING_STATUSES] } }, { status: "AWAITING_PAYMENT", paymentDeadline: { gt: now } }],
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [`${dateToDay(r.date)}|${r.shiftId}`, r._count._all]));
}

/**
 * Creates a booking under a lock on the shift row (so two customers can't take the last place).
 * `window` = the customer's booking window (website); admin/API bookings only need a shift that hasn't started.
 */
export async function createBooking(
  input: NewBookingInput,
  opts: { userId: string | null; source: "WEB" | "ADMIN" | "API"; providerKey: string | null; window?: { daysAhead: number; minHoursBefore: number }; paymentMinutes: number; maxGuests?: number; now?: Date },
): Promise<{ id: string; code: string; payNow: bigint; paymentId: string | null; total: bigint }> {
  const now = opts.now ?? new Date();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM booking_shifts WHERE id = ${input.shiftId} FOR UPDATE`;
    const shift = await tx.bookingShift.findUnique({ where: { id: input.shiftId } });
    if (!shift || !shift.isActive) throw new BookingError("این شیفت در دسترس نیست.");
    if (!shift.weekdays.includes(persianWeekday(input.date))) throw new BookingError("این شیفت در روز انتخاب‌شده برگزار نمی‌شود.");
    if (await tx.bookingClosure.findUnique({ where: { date: dayToDate(input.date) } })) throw new BookingError("مجموعه در این روز رزرو نمی‌پذیرد.");
    const start = shiftStart(input.date, shift.startMinute);
    if (opts.window) {
      const last = addDays(tehranDay(now), opts.window.daysAhead - 1);
      if (input.date > last) throw new BookingError("این روز هنوز برای رزرو باز نشده است.");
      if (start.getTime() - opts.window.minHoursBefore * 3600_000 <= now.getTime()) throw new BookingError("زمان رزرو این شیفت گذشته است.");
    } else if (start <= now) {
      throw new BookingError("این شیفت شروع شده یا گذشته است.");
    }
    if (opts.maxGuests && input.guests && input.guests > opts.maxGuests) throw new BookingError(`تعداد نفرات حداکثر ${opts.maxGuests.toLocaleString("fa-IR")} است.`);
    const taken = (await takenPlaces(tx, input.date, input.date, now)).get(`${input.date}|${shift.id}`) ?? 0;
    if (taken >= shift.capacity) throw new BookingError("ظرفیت این شیفت تکمیل شده است.");

    // Admin/API bookings are settled at the venue; website bookings follow the shift's payment mode.
    const mode = opts.source === "WEB" && opts.providerKey ? shift.paymentMode : opts.source === "WEB" && shift.paymentMode !== "ON_SITE" ? null : "ON_SITE";
    if (!mode) throw new BookingError("پرداخت آنلاین در حال حاضر فعال نیست؛ برای رزرو تماس بگیرید.");

    let discount = BigInt(0);
    let codeId: string | null = null;
    if (input.discountCode) {
      try {
        const d = await lockDiscount(tx, { code: input.discountCode, scope: "BOOKING", amount: shift.price, userId: opts.userId });
        discount = mode === "ON_SITE" ? d.discount : capForGateway(shift.price, d.discount);
        codeId = d.id;
      } catch (e) {
        if (e instanceof DiscountError) throw new BookingError(`کد تخفیف: ${e.message}`);
        throw e;
      }
    }
    const total = shift.price - discount;
    const payNow = amountToPayNow(total, mode, shift.depositPercent);
    let code = makeBookingCode();
    for (let i = 0; i < 5 && (await tx.booking.findUnique({ where: { code }, select: { id: true } })); i++) code = makeBookingCode();

    const booking = await tx.booking.create({
      data: {
        code,
        userId: opts.userId,
        name: input.name,
        phone: input.phone,
        guests: input.guests ?? null,
        note: input.note || null,
        date: dayToDate(input.date),
        shiftId: shift.id,
        shiftTitle: shift.title,
        startMinute: shift.startMinute,
        endMinute: shift.endMinute,
        price: shift.price,
        discount,
        total,
        payNow,
        paymentMode: mode,
        status: payNow > BigInt(0) ? "AWAITING_PAYMENT" : "CONFIRMED",
        paymentDeadline: payNow > BigInt(0) ? new Date(now.getTime() + opts.paymentMinutes * 60_000) : null,
        source: opts.source,
      },
      select: { id: true, code: true },
    });
    if (codeId) await recordRedemption(tx, { codeId, userId: opts.userId, scope: "BOOKING", amount: discount, bookingId: booking.id });
    let paymentId: string | null = null;
    if (payNow > BigInt(0)) {
      paymentId = (await tx.payment.create({ data: { provider: opts.providerKey!, amount: payNow, bookingId: booking.id }, select: { id: true } })).id;
    }
    return { id: booking.id, code: booking.code, payNow, paymentId, total };
  });
}

/** Gateway result for a booking payment. Idempotent; a payment that arrives too late is kept for a refund. */
export async function applyBookingPayment(paymentId: string, result: Result): Promise<"paid" | "failed" | "already_processed" | "late_paid_needs_refund"> {
  const outcome = await db.$transaction(async (tx) => {
    const p = await tx.payment.findUnique({ where: { id: paymentId }, select: { bookingId: true, amount: true } });
    if (!p?.bookingId) throw new Error("payment_without_booking");
    if (!result.ok) {
      const c = await tx.payment.updateMany({ where: { id: paymentId, status: "INITIATED" }, data: { status: "FAILED", raw: (result.raw ?? { reason: result.reason }) as Prisma.InputJsonValue } });
      if (c.count) await tx.booking.updateMany({ where: { id: p.bookingId, status: "AWAITING_PAYMENT" }, data: { status: "CANCELLED", cancelReason: `پرداخت ناموفق (${result.reason})`.slice(0, 300) } });
      return c.count ? ("failed" as const) : ("already_processed" as const);
    }
    const c = await tx.payment.updateMany({
      where: { id: paymentId, status: "INITIATED" },
      data: { status: "SUCCEEDED", referenceId: result.referenceId, cardPanMasked: result.cardPanMasked ?? null, raw: (result.raw ?? {}) as Prisma.InputJsonValue },
    });
    if (!c.count) return "already_processed" as const;
    const b = await tx.booking.findUniqueOrThrow({ where: { id: p.bookingId } });
    if (b.shiftId) await tx.$queryRaw`SELECT id FROM booking_shifts WHERE id = ${b.shiftId} FOR UPDATE`;
    if (b.status === "AWAITING_PAYMENT" && (!b.paymentDeadline || b.paymentDeadline > new Date())) {
      await tx.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", paidAmount: { increment: p.amount }, paymentDeadline: null } });
      return "paid" as const;
    }
    // Paid after the hold ended: keep it if the place is still free, otherwise the money is returned.
    const shift = b.shiftId ? await tx.bookingShift.findUnique({ where: { id: b.shiftId }, select: { capacity: true } }) : null;
    const day = dateToDay(b.date);
    const taken = (await takenPlaces(tx, day, day, new Date(), b.id)).get(`${day}|${b.shiftId}`) ?? 0;
    const started = shiftStart(day, b.startMinute) <= new Date();
    if ((b.status === "AWAITING_PAYMENT" || b.status === "CANCELLED") && shift && taken < shift.capacity && !started && !b.refundStatus) {
      await tx.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED", paidAmount: { increment: p.amount }, paymentDeadline: null, cancelReason: null } });
      return "paid" as const;
    }
    await tx.booking.update({ where: { id: b.id }, data: { status: "CANCELLED", paidAmount: { increment: p.amount }, refundStatus: "NEEDED", cancelReason: "پرداخت بعد از پایان مهلت انجام شد و ظرفیت پر شده بود" } });
    return "late_paid_needs_refund" as const;
  });
  return outcome;
}

/** Unpaid bookings past their hold are cancelled (the place frees up as soon as the deadline passes anyway). */
export async function expireStaleBookings(now = new Date()): Promise<number> {
  const { count } = await db.booking.updateMany({ where: { status: "AWAITING_PAYMENT", paymentDeadline: { lt: now } }, data: { status: "CANCELLED", cancelReason: "مهلت پرداخت تمام شد" } });
  return count;
}

const TRANSITIONS: Record<BookingStatusKey, BookingStatusKey[]> = {
  AWAITING_PAYMENT: ["CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED"],
  COMPLETED: ["CONFIRMED"],
  NO_SHOW: ["CONFIRMED"],
  CANCELLED: [],
};

export function allowedTransitions(from: BookingStatusKey): BookingStatusKey[] {
  return TRANSITIONS[from];
}

/** Staff status change. Cancelling a booking that was paid online marks the money for return. */
export async function changeBookingStatus(id: string, to: BookingStatusKey, reason: string | null) {
  return db.$transaction(async (tx) => {
    const b = await tx.booking.findUnique({ where: { id } });
    if (!b) throw new BookingError("رزرو پیدا نشد.");
    if (!TRANSITIONS[b.status].includes(to)) throw new BookingError("این تغییر وضعیت مجاز نیست.");
    await tx.booking.update({
      where: { id },
      data: {
        status: to,
        ...(to === "CANCELLED" ? { cancelReason: (reason || "لغو توسط مجموعه").slice(0, 300), refundStatus: b.paidAmount > BigInt(0) ? "NEEDED" : null, paymentDeadline: null } : {}),
      },
    });
    if (to === "CANCELLED") await tx.payment.updateMany({ where: { bookingId: id, status: "INITIATED" }, data: { status: "CANCELLED" } });
    return { ...b, status: to };
  });
}
