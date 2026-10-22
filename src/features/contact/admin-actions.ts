"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, type ActionResult } from "@/lib/action-result";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const statusSchema = z.enum(["NEW", "READ", "ARCHIVED"]);

export async function setMessageStatus(id: string, status: unknown): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail("دسترسی غیرمجاز.");
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success || typeof id !== "string") return fail("درخواست نامعتبر است.");
  const { count } = await db.contactMessage.updateMany({ where: { id }, data: { status: parsed.data } });
  if (!count) return fail("پیام پیدا نشد.");
  revalidatePath("/admin/messages");
  return ok(undefined, parsed.data === "ARCHIVED" ? "پیام بایگانی شد." : "وضعیت پیام به‌روزرسانی شد.");
}

export async function deleteMessage(id: string): Promise<ActionResult<undefined>> {
  if (!(await admin())) return fail("دسترسی غیرمجاز.");
  const { count } = await db.contactMessage.deleteMany({ where: { id } });
  if (!count) return fail("پیام پیدا نشد.");
  revalidatePath("/admin/messages");
  return ok(undefined, "پیام حذف شد.");
}
