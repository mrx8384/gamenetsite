"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, isUniqueViolation, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { planSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

function refresh() {
  revalidatePath("/admin/subscriptions");
  revalidatePath("/partners");
  revalidatePath("/partner");
}

/** Create/update a plan. Plans are never purchasable here: `isActive` is not settable (always false). */
export async function savePlan(id: string | null, input: unknown): Promise<ActionResult<{ id: string }>> {
  const actor = await admin();
  if (!actor) return fail("دسترسی غیرمجاز.");
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const { priceToman, ...rest } = parsed.data;
  const data = { ...rest, description: rest.description || null, price: priceToman, isActive: false };
  try {
    const plan = id
      ? await db.subscriptionPlan.update({ where: { id }, data, select: { id: true } })
      : await db.subscriptionPlan.create({ data, select: { id: true } });
    const { ip } = await getRequestInfo();
    await audit({ actorId: actor.id, action: id ? "plans.updated" : "plans.created", entity: "plan", entityId: plan.id, ip, meta: { code: data.code } });
    refresh();
    return ok(plan, "اشتراک ذخیره شد.");
  } catch (e) {
    if (isUniqueViolation(e)) return fail("این کد قبلاً استفاده شده است.", { code: "این کد قبلاً استفاده شده است." });
    if ((e as { code?: string })?.code === "P2025") return fail("اشتراک پیدا نشد.");
    throw e;
  }
}

/** Plans that were ever used by a partner are kept (history); hide them instead. */
export async function deletePlan(id: string): Promise<ActionResult<undefined>> {
  const actor = await admin();
  if (!actor) return fail("دسترسی غیرمجاز.");
  if (typeof id !== "string") return fail("درخواست نامعتبر است.");
  const used = await db.partnerSubscription.count({ where: { planId: id } });
  if (used > 0) return fail("این اشتراک سابقهٔ استفاده دارد و حذف نمی‌شود؛ می‌توانید آن را مخفی کنید.");
  const res = await db.subscriptionPlan.deleteMany({ where: { id } });
  if (res.count === 0) return fail("اشتراک پیدا نشد.");
  const { ip } = await getRequestInfo();
  await audit({ actorId: actor.id, action: "plans.deleted", entity: "plan", entityId: id, ip });
  refresh();
  return ok(undefined, "اشتراک حذف شد.");
}
