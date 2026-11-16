"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { BOOKING_CONFIG_KEY, getBookingConfig } from "./config";
import { BOOKING_STATUS_LABELS, dayToDate } from "./rules";
import { bookingConfigSchema, closureSchema, newBookingSchema, shiftSchema } from "./schemas";
import { BookingError, changeBookingStatus, createBooking } from "./service";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

async function log(actorId: string, action: string, entityId: string, meta?: Record<string, string | number | boolean | null>) {
  const { ip } = await getRequestInfo();
  await audit({ actorId, action, entity: "booking", entityId, ip, meta });
}

const refresh = () => {
  revalidatePath("/admin/booking");
  revalidatePath("/admin/booking/setup");
  revalidatePath("/booking");
};

export async function saveShift(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const saved = id
    ? await db.bookingShift.update({ where: { id }, data: parsed.data, select: { id: true } }).catch(() => null)
    : await db.bookingShift.create({ data: parsed.data, select: { id: true } });
  if (!saved) return fail("شیفت پیدا نشد.");
  await log(user.id, id ? "booking.shift_updated" : "booking.shift_created", saved.id, { title: parsed.data.title });
  refresh();
  return ok(saved, "شیفت ذخیره شد. رزروهای قبلی ساعت و قیمت زمان رزرو را حفظ می‌کنند.");
}

/** A shift with bookings is kept (their history) and switched off. */
export async function deleteShift(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const used = await db.booking.count({ where: { shiftId: String(id) } });
  if (used) {
    await db.bookingShift.update({ where: { id: String(id) }, data: { isActive: false } }).catch(() => null);
    refresh();
    return ok(undefined, "این شیفت رزرو دارد؛ برای حفظ سابقه فقط غیرفعال شد.");
  }
  const { count } = await db.bookingShift.deleteMany({ where: { id: String(id) } });
  if (!count) return fail("شیفت پیدا نشد.");
  await log(user.id, "booking.shift_deleted", String(id));
  refresh();
  return ok(undefined, "شیفت حذف شد.");
}

export async function addClosure(input: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = closureSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "تاریخ معتبر نیست.");
  const date = dayToDate(parsed.data.date);
  await db.bookingClosure.upsert({ where: { date }, create: { date, reason: parsed.data.reason || null }, update: { reason: parsed.data.reason || null } });
  const active = await db.booking.count({ where: { date, status: { in: ["CONFIRMED", "AWAITING_PAYMENT"] } } });
  await log(user.id, "booking.closure_added", parsed.data.date);
  refresh();
  return ok(undefined, active ? `روز تعطیل ثبت شد. توجه: ${active.toLocaleString("fa-IR")} رزرو فعال در این روز هست؛ آن‌ها را از فهرست رزروها بررسی کنید.` : "روز تعطیل ثبت شد.");
}

export async function removeClosure(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  await db.bookingClosure.deleteMany({ where: { id: String(id) } });
  await log(user.id, "booking.closure_removed", String(id));
  refresh();
  return ok(undefined, "روز تعطیل حذف شد.");
}

export async function saveBookingConfig(input: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = bookingConfigSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  await db.siteSetting.upsert({ where: { key: BOOKING_CONFIG_KEY }, create: { key: BOOKING_CONFIG_KEY, value: parsed.data }, update: { value: parsed.data } });
  await log(user.id, "booking.config_saved", BOOKING_CONFIG_KEY, parsed.data);
  updateTag(CACHE_TAGS.settings);
  refresh();
  return ok(undefined, "تنظیمات رزرو ذخیره شد.");
}

/** Booking taken by phone / at the counter: confirmed, paid at the venue. */
export async function adminCreateBooking(input: unknown): Promise<ActionResult<{ code: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = newBookingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است.", zodFieldErrors(parsed.error.issues));
  const config = await getBookingConfig();
  try {
    const b = await createBooking(parsed.data, { userId: null, source: "ADMIN", providerKey: null, paymentMinutes: config.paymentMinutes });
    await log(user.id, "booking.created_by_admin", b.id, { code: b.code });
    refresh();
    return ok({ code: b.code }, `رزرو ${b.code} ثبت شد.`);
  } catch (e) {
    if (e instanceof BookingError) return fail(e.message);
    throw e;
  }
}

const statusSchema = z.object({ id: z.string().min(1), to: z.enum(["CONFIRMED", "COMPLETED", "NO_SHOW", "CANCELLED"]), reason: z.string().trim().max(300).default("") });

export async function setBookingStatus(input: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return fail("درخواست نامعتبر است.");
  try {
    const b = await changeBookingStatus(parsed.data.id, parsed.data.to, parsed.data.reason || null);
    await log(user.id, "booking.status", b.id, { to: parsed.data.to });
    refresh();
    return ok(undefined, b.refundStatus === "NEEDED" || (parsed.data.to === "CANCELLED" && b.paidAmount > BigInt(0)) ? "رزرو لغو شد؛ مبلغ پرداختی در فهرست «بازگشت وجه» آمد." : `وضعیت: ${BOOKING_STATUS_LABELS[parsed.data.to]}`);
  } catch (e) {
    if (e instanceof BookingError) return fail(e.message);
    throw e;
  }
}

export async function markBookingRefunded(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const { count } = await db.booking.updateMany({ where: { id: String(id), refundStatus: "NEEDED" }, data: { refundStatus: "DONE" } });
  if (!count) return fail("موردی برای بازگشت وجه پیدا نشد.");
  await log(user.id, "booking.refunded", String(id));
  refresh();
  return ok(undefined, "بازگشت وجه ثبت شد.");
}

export async function saveBookingNote(id: string, note: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const text = typeof note === "string" ? note.trim().slice(0, 500) : "";
  await db.booking.updateMany({ where: { id: String(id) }, data: { adminNote: text || null } });
  refresh();
  return ok(undefined, "یادداشت ذخیره شد.");
}
