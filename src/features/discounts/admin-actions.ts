"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, isUniqueViolation, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { discountCodeSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

export async function saveDiscountCode(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = discountCodeSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  let saved: { id: string } | null;
  try {
    saved = id
      ? await db.discountCode.update({ where: { id }, data: parsed.data, select: { id: true } }).catch((e) => {
          if (isUniqueViolation(e)) throw e;
          return null;
        })
      : await db.discountCode.create({ data: parsed.data, select: { id: true } });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("این کد قبلاً ساخته شده است.", { code: "کد تکراری است" });
    throw e;
  }
  if (!saved) return fail("کد تخفیف پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: id ? "discount.updated" : "discount.created", entity: "discount_code", entityId: saved.id, ip, meta: { code: parsed.data.code } });
  revalidatePath("/admin/discounts");
  return ok(saved, "کد تخفیف ذخیره شد.");
}

/** Codes that were used are kept (history) and only switched off. */
export async function deleteDiscountCode(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const used = await db.discountRedemption.count({ where: { codeId: String(id) } });
  if (used) {
    await db.discountCode.update({ where: { id: String(id) }, data: { isActive: false } }).catch(() => null);
    revalidatePath("/admin/discounts");
    return ok(undefined, "این کد قبلاً استفاده شده؛ برای حفظ سابقه، فقط غیرفعال شد.");
  }
  const { count } = await db.discountCode.deleteMany({ where: { id: String(id) } });
  if (!count) return fail("کد تخفیف پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "discount.deleted", entity: "discount_code", entityId: String(id), ip });
  revalidatePath("/admin/discounts");
  return ok(undefined, "کد تخفیف حذف شد.");
}
