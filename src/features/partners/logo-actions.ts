"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, assertUser, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { deleteUnusedMedia, storeImage, UploadError } from "@/features/media/storage";

async function sessionUser() {
  try {
    return (await assertUser()).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

async function adminUser() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const refresh = (partnerId: string) => {
  revalidatePath("/partner", "layout");
  revalidatePath(`/admin/partners/${partnerId}`);
  revalidatePath("/admin/partners");
};

/** An approved partner sends their logo; it is used only after an admin approves it. */
export async function submitPartnerLogo(formData: FormData): Promise<ActionResult<undefined>> {
  const user = await sessionUser();
  if (!user) return fail("برای ادامه وارد حساب کاربری شوید.");
  const partner = await db.partnerProfile.findUnique({ where: { userId: user.id }, select: { id: true, status: true, pendingLogoId: true } });
  if (!partner || partner.status !== "APPROVED") return fail("ارسال لوگو فقط برای همکاران تأییدشده ممکن است.");
  if (!(await rateLimit(`partner-logo:${user.id}`, 10, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("تصویری انتخاب نشده است.");
  let mediaId: string;
  try {
    mediaId = (await storeImage(Buffer.from(await file.arrayBuffer()), { folder: "partners", uploaderId: user.id, originalName: file.name, maxWidth: 600 })).id;
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message);
    console.error("[partners] logo upload failed", e);
    return fail("ذخیرهٔ تصویر ناموفق بود.");
  }
  await db.partnerProfile.update({ where: { id: partner.id }, data: { pendingLogoId: mediaId, logoSubmittedAt: new Date(), logoRejectReason: null } });
  if (partner.pendingLogoId) await deleteUnusedMedia([partner.pendingLogoId]);
  const { ip } = await getRequestInfo();
  await audit({ actorId: user.id, action: "partners.logo_submitted", entity: "partner", entityId: partner.id, ip });
  refresh(partner.id);
  return ok(undefined, "لوگو ارسال شد و بعد از تأیید اتم نمایش داده می‌شود.");
}

/** The partner takes back a logo that is still waiting for review. */
export async function withdrawPartnerLogo(): Promise<ActionResult<undefined>> {
  const user = await sessionUser();
  if (!user) return fail("برای ادامه وارد حساب کاربری شوید.");
  const partner = await db.partnerProfile.findUnique({ where: { userId: user.id }, select: { id: true, pendingLogoId: true } });
  if (!partner?.pendingLogoId) return fail("لوگویی در انتظار بررسی نیست.");
  await db.partnerProfile.update({ where: { id: partner.id }, data: { pendingLogoId: null, logoSubmittedAt: null } });
  await deleteUnusedMedia([partner.pendingLogoId]);
  refresh(partner.id);
  return ok(undefined, "لوگوی ارسالی پس گرفته شد.");
}

/** Admin: approve (replaces the current logo) or reject the submitted logo. */
export async function reviewPartnerLogo(partnerId: unknown, decision: unknown, reason: unknown): Promise<ActionResult<undefined>> {
  const actor = await adminUser();
  if (!actor) return fail("دسترسی غیرمجاز.");
  if (typeof partnerId !== "string" || (decision !== "approve" && decision !== "reject")) return fail("درخواست نامعتبر است.");
  const why = typeof reason === "string" ? reason.trim().slice(0, 300) : "";
  if (decision === "reject" && why.length < 3) return fail("دلیل رد را بنویسید تا همکار بداند چه چیزی را اصلاح کند.");
  const partner = await db.partnerProfile.findUnique({ where: { id: partnerId }, select: { id: true, logoId: true, pendingLogoId: true } });
  if (!partner?.pendingLogoId) return fail("لوگویی در انتظار بررسی نیست.");
  if (decision === "approve") {
    await db.partnerProfile.update({ where: { id: partner.id }, data: { logoId: partner.pendingLogoId, pendingLogoId: null, logoRejectReason: null } });
    if (partner.logoId) await deleteUnusedMedia([partner.logoId]);
  } else {
    await db.partnerProfile.update({ where: { id: partner.id }, data: { pendingLogoId: null, logoRejectReason: why } });
    await deleteUnusedMedia([partner.pendingLogoId]);
  }
  const { ip } = await getRequestInfo();
  await audit({ actorId: actor.id, action: decision === "approve" ? "partners.logo_approved" : "partners.logo_rejected", entity: "partner", entityId: partner.id, ip, meta: why ? { reason: why } : undefined });
  refresh(partner.id);
  return ok(undefined, decision === "approve" ? "لوگو تأیید شد و در پنل همکار نمایش داده می‌شود." : "لوگو رد شد.");
}

/** Admin: remove the approved logo (the partner's name is shown instead). */
export async function removePartnerLogo(partnerId: unknown): Promise<ActionResult<undefined>> {
  const actor = await adminUser();
  if (!actor) return fail("دسترسی غیرمجاز.");
  if (typeof partnerId !== "string") return fail("درخواست نامعتبر است.");
  const partner = await db.partnerProfile.findUnique({ where: { id: partnerId }, select: { id: true, logoId: true } });
  if (!partner?.logoId) return fail("این همکار لوگوی تأییدشده ندارد.");
  await db.partnerProfile.update({ where: { id: partner.id }, data: { logoId: null } });
  await deleteUnusedMedia([partner.logoId]);
  const { ip } = await getRequestInfo();
  await audit({ actorId: actor.id, action: "partners.logo_removed", entity: "partner", entityId: partner.id, ip });
  refresh(partner.id);
  return ok(undefined, "لوگو حذف شد.");
}
