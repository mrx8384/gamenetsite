"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { parseTomanToRial } from "@/lib/text";
import { shippingMethodSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

export async function saveShippingMethod(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = shippingMethodSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { priceToman, description, trackingUrl, ...rest } = parsed.data;
  const data = {
    ...rest,
    description: description || null,
    trackingUrl: trackingUrl || null,
    price: rest.type === "PREPAID" ? parseTomanToRial(priceToman || "0")! : BigInt(0),
  };
  const saved = id
    ? await db.shippingMethod.update({ where: { id }, data, select: { id: true } }).catch(() => null)
    : await db.shippingMethod.create({ data, select: { id: true } });
  if (!saved) return fail("روش ارسال پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: id ? "shipping.updated" : "shipping.created", entity: "shipping_method", entityId: saved.id, ip });
  revalidatePath("/admin/shipping");
  return ok(saved, "روش ارسال ذخیره شد.");
}

export async function deleteShippingMethod(id: string): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  // Orders keep a snapshot (name/type), so deleting is safe for history.
  const { count } = await db.shippingMethod.deleteMany({ where: { id } });
  if (!count) return fail("روش ارسال پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "shipping.deleted", entity: "shipping_method", entityId: id, ip });
  revalidatePath("/admin/shipping");
  return ok(undefined, "روش ارسال حذف شد.");
}
