"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, isUniqueViolation, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { nextGrantStart } from "./entitlement-rules";
import { grantSchema, planSchema } from "./schemas";

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

// ───────────── Manual grants (free, by admin) ─────────────

/**
 * Grants a plan to an APPROVED partner without payment. A renewal starts when the partner's
 * latest active period ends. Recorded with the admin's name in the note and in the audit log.
 */
export async function grantSubscription(partnerId: string, input: unknown): Promise<ActionResult<{ startsAt: string; endsAt: string }>> {
  const actor = await admin();
  if (!actor) return fail("دسترسی غیرمجاز.");
  const parsed = grantSchema.safeParse(input);
  if (!parsed.success || typeof partnerId !== "string") return fail(parsed.success ? "درخواست نامعتبر است." : "لطفاً خطاهای فرم را برطرف کنید.", parsed.success ? undefined : zodFieldErrors(parsed.error.issues));
  const { planId, durationDays, note } = parsed.data;

  const result = await db.$transaction(async (tx) => {
    // Lock the partner row so two grants at once can't overlap.
    await tx.$queryRaw`SELECT id FROM partner_profiles WHERE id = ${partnerId} FOR UPDATE`;
    const partner = await tx.partnerProfile.findUnique({
      where: { id: partnerId },
      select: { status: true, subscriptions: { where: { status: "ACTIVE" }, select: { status: true, startsAt: true, endsAt: true } } },
    });
    if (!partner) return "not-found" as const;
    if (partner.status !== "APPROVED") return "not-approved" as const;
    const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId }, select: { id: true, name: true } });
    if (!plan) return "no-plan" as const;
    const startsAt = nextGrantStart(partner.subscriptions);
    const endsAt = new Date(startsAt.getTime() + durationDays * 86_400_000);
    const sub = await tx.partnerSubscription.create({
      data: { partnerId, planId, status: "ACTIVE", startsAt, endsAt, note: `اعطای دستی توسط ${actor.name}${note ? ` — ${note}` : ""}`.slice(0, 500) },
      select: { id: true },
    });
    return { id: sub.id, plan: plan.name, startsAt, endsAt };
  });
  if (result === "not-found") return fail("همکار پیدا نشد.");
  if (result === "not-approved") return fail("اشتراک فقط به همکار تأییدشده داده می‌شود.");
  if (result === "no-plan") return fail("اشتراک انتخاب‌شده پیدا نشد.", { planId: "اشتراک انتخاب‌شده پیدا نشد." });

  const { ip } = await getRequestInfo();
  await audit({ actorId: actor.id, action: "subscriptions.granted", entity: "partner", entityId: partnerId, ip, meta: { subscriptionId: result.id, plan: result.plan, days: durationDays, startsAt: result.startsAt.toISOString(), endsAt: result.endsAt.toISOString() } });
  revalidatePath(`/admin/partners/${partnerId}`);
  revalidatePath("/admin/subscriptions");
  return ok({ startsAt: result.startsAt.toISOString(), endsAt: result.endsAt.toISOString() }, "اشتراک اعطا شد.");
}

/** Cancels a subscription immediately (access ends now). */
export async function cancelSubscription(subscriptionId: string): Promise<ActionResult<undefined>> {
  const actor = await admin();
  if (!actor) return fail("دسترسی غیرمجاز.");
  if (typeof subscriptionId !== "string") return fail("درخواست نامعتبر است.");
  const res = await db.partnerSubscription.updateMany({ where: { id: subscriptionId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
  if (res.count === 0) return fail("این اشتراک فعال نیست یا پیدا نشد.");
  const sub = await db.partnerSubscription.findUnique({ where: { id: subscriptionId }, select: { partnerId: true } });
  const { ip } = await getRequestInfo();
  await audit({ actorId: actor.id, action: "subscriptions.cancelled", entity: "partner", entityId: sub?.partnerId ?? null, ip, meta: { subscriptionId } });
  if (sub) revalidatePath(`/admin/partners/${sub.partnerId}`);
  revalidatePath("/admin/subscriptions");
  return ok(undefined, "اشتراک لغو شد.");
}
