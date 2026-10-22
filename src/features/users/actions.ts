"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { revokeUserSessions } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";

const roleSchema = z.enum(["ADMIN", "USER", "PARTNER"]);

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
