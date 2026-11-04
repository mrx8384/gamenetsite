"use server";

import { revalidatePath } from "next/cache";
import { ACCOUNTS_SETTINGS_KEY, accountsSettingsSchema, deletionBlocker, inactiveCutoff, inactiveUsersWhere } from "./cleanup";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { revokeUserSessions } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";

const roleSchema = z.enum(["ADMIN", "USER", "PARTNER", "SUPPORT"]);

async function adminSession() {
  try {
    return await assertRole(["ADMIN"]);
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

/** Prevents locking everyone out of the admin panel. */
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true }, take: 2 });
  return admins.length === 1 && admins[0].id === userId;
}

export async function setUserRole(userId: string, role: unknown): Promise<ActionResult<undefined>> {
  const s = await adminSession();
  if (!s) return fail("دسترسی غیرمجاز.");
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success || typeof userId !== "string") return fail("اطلاعات نامعتبر است.");
  if (userId === s.user.id) return fail("نمی‌توانید نقش حساب خودتان را تغییر دهید.");

  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return fail("کاربر پیدا نشد.");
  if (target.role === parsedRole.data) return ok(undefined, "تغییری ایجاد نشد.");
  if (target.role === "ADMIN" && (await isLastActiveAdmin(userId))) return fail("حداقل یک مدیر فعال باید باقی بماند.");
  // The PARTNER role mirrors an approved partner profile; it is managed only from Admin → همکاران.
  if (parsedRole.data === "PARTNER" || target.role === "PARTNER") {
    return fail("نقش همکار فقط از بخش «همکاران» (تأیید یا تعلیق درخواست همکاری) تغییر می‌کند.");
  }

  await db.user.update({ where: { id: userId }, data: { role: parsedRole.data, sessionVersion: { increment: 1 } } });
  await revokeUserSessions(userId); // new permissions take effect on next login
  const { ip } = await getRequestInfo();
  await audit({ actorId: s.user.id, action: "users.role_changed", entity: "user", entityId: userId, ip, meta: { from: target.role, to: parsedRole.data } });
  revalidatePath("/admin/users");
  return ok(undefined, "نقش کاربر تغییر کرد.");
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult<undefined>> {
  const s = await adminSession();
  if (!s) return fail("دسترسی غیرمجاز.");
  if (typeof userId !== "string" || typeof active !== "boolean") return fail("اطلاعات نامعتبر است.");
  if (userId === s.user.id) return fail("نمی‌توانید حساب خودتان را غیرفعال کنید.");

  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true, isActive: true } });
  if (!target) return fail("کاربر پیدا نشد.");
  if (!active && target.role === "ADMIN" && (await isLastActiveAdmin(userId))) return fail("حداقل یک مدیر فعال باید باقی بماند.");

  await db.user.update({ where: { id: userId }, data: { isActive: active } });
  if (!active) await revokeUserSessions(userId);
  const { ip } = await getRequestInfo();
  await audit({ actorId: s.user.id, action: active ? "users.activated" : "users.deactivated", entity: "user", entityId: userId, ip });
  revalidatePath("/admin/users");
  return ok(undefined, active ? "حساب کاربر فعال شد." : "حساب کاربر غیرفعال شد و از همهٔ دستگاه‌ها خارج شد.");
}

export async function revokeAllUserSessions(userId: string): Promise<ActionResult<undefined>> {
  const s = await adminSession();
  if (!s) return fail("دسترسی غیرمجاز.");
  if (typeof userId !== "string") return fail("اطلاعات نامعتبر است.");
  const count = await revokeUserSessions(userId, userId === s.user.id ? s.sessionId : undefined);
  const { ip } = await getRequestInfo();
  await audit({ actorId: s.user.id, action: "users.sessions_revoked", entity: "user", entityId: userId, ip, meta: { count } });
  revalidatePath("/admin/users");
  return ok(undefined, "کاربر از همهٔ دستگاه‌ها خارج شد.");
}

/** Permanently deletes an account (sessions, addresses, cart, chats, points go with it). */
export async function deleteUser(userId: unknown): Promise<ActionResult<undefined>> {
  const s = await adminSession();
  if (!s) return fail("دسترسی غیرمجاز.");
  if (typeof userId !== "string" || !userId) return fail("اطلاعات نامعتبر است.");
  if (userId === s.user.id) return fail("نمی‌توانید حساب خودتان را حذف کنید.");
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, role: true, _count: { select: { orders: true } }, partnerProfile: { select: { id: true, _count: { select: { subscriptions: { where: { paymentId: { not: null } } } } } } } },
  });
  if (!target) return fail("کاربر پیدا نشد.");
  const blocker = deletionBlocker({ role: target.role, orderCount: target._count.orders, paidSubscriptionCount: target.partnerProfile?._count.subscriptions ?? 0 });
  if (blocker) return fail(blocker);

  const { ip } = await getRequestInfo();
  // Audit first: the entry keeps who was removed (the user row and its links disappear).
  await audit({ actorId: s.user.id, action: "users.deleted", entity: "user", entityId: userId, ip, meta: { name: target.name, email: target.email, phone: target.phone, role: target.role, partner: !!target.partnerProfile } });
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/admin/users");
  return ok(undefined, "حساب کاربر حذف شد.");
}

export async function saveAccountsSettings(input: unknown): Promise<ActionResult<undefined>> {
  const s = await adminSession();
  if (!s) return fail("دسترسی غیرمجاز.");
  const parsed = accountsSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("مقدار نامعتبر است.");
  const value = parsed.data;
  await db.siteSetting.upsert({ where: { key: ACCOUNTS_SETTINGS_KEY }, create: { key: ACCOUNTS_SETTINGS_KEY, value }, update: { value } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: s.user.id, action: "users.cleanup_settings", entity: "site_setting", entityId: ACCOUNTS_SETTINGS_KEY, ip, meta: value });
  revalidatePath("/admin/users");
  return ok(undefined, value.inactiveDeleteMonths ? "حذف خودکار فعال شد؛ هر شب اجرا می‌شود." : "حذف خودکار خاموش شد.");
}

/** How many accounts the chosen period would remove now (preview before saving). */
export async function previewInactiveCleanup(months: unknown): Promise<ActionResult<{ count: number }>> {
  const s = await adminSession();
  if (!s) return fail("دسترسی غیرمجاز.");
  const parsed = accountsSettingsSchema.safeParse({ inactiveDeleteMonths: months });
  if (!parsed.success) return fail("مقدار نامعتبر است.");
  const m = parsed.data.inactiveDeleteMonths;
  if (!m) return ok({ count: 0 });
  return ok({ count: await db.user.count({ where: inactiveUsersWhere(inactiveCutoff(m)) }) });
}
