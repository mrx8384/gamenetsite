"use server";

import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertUser, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { partnerApplicationSchema } from "./schemas";

async function currentUser() {
  try {
    return (await assertUser()).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

/**
 * Submit a new partner application, edit a pending one, or resubmit after rejection.
 * Approved partners update their profile here too, but business name/type stay locked
 * (changing them needs a new review by the admin).
 */
export async function savePartnerApplication(input: unknown): Promise<ActionResult<{ status: string }>> {
  const user = await currentUser();
  if (!user) return fail("برای ثبت درخواست ابتدا وارد حساب خود شوید.");
  if (user.role === "ADMIN") return fail("حساب مدیر نمی‌تواند درخواست همکاری ثبت کند.");
  if (!(await rateLimit(`partner-apply:${user.id}`, 10, 60 * 60)).allowed) return fail(RATE_LIMIT_ERROR);

  const parsed = partnerApplicationSchema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const data = parsed.data;
  const fields = {
    province: data.province,
    city: data.city,
    address: data.address,
    phone: data.phone,
    website: data.website || null,
    instagram: data.instagram || null,
    description: data.description || null,
  };

  const existing = await db.partnerProfile.findUnique({ where: { userId: user.id }, select: { id: true, status: true } });
  const { ip } = await getRequestInfo();

  if (!existing) {
    const created = await db.partnerProfile.create({
      data: { userId: user.id, businessName: data.businessName, businessType: data.businessType, ...fields },
      select: { id: true },
    });
    await audit({ actorId: user.id, action: "partners.applied", entity: "partner", entityId: created.id, ip });
    return ok({ status: "PENDING" }, "درخواست همکاری ثبت شد و پس از بررسی نتیجه اعلام می‌شود.");
  }

  switch (existing.status) {
    case "PENDING":
      await db.partnerProfile.update({ where: { id: existing.id }, data: { businessName: data.businessName, businessType: data.businessType, ...fields } });
      await audit({ actorId: user.id, action: "partners.application_edited", entity: "partner", entityId: existing.id, ip });
      return ok({ status: "PENDING" }, "درخواست شما به‌روزرسانی شد.");
    case "REJECTED":
      await db.partnerProfile.update({
        where: { id: existing.id },
        data: { businessName: data.businessName, businessType: data.businessType, ...fields, status: "PENDING", submittedAt: new Date(), rejectionReason: null, reviewedAt: null, reviewedById: null },
      });
      await audit({ actorId: user.id, action: "partners.resubmitted", entity: "partner", entityId: existing.id, ip });
      return ok({ status: "PENDING" }, "درخواست دوباره برای بررسی ارسال شد.");
    case "APPROVED":
      await db.partnerProfile.update({ where: { id: existing.id }, data: fields });
      await audit({ actorId: user.id, action: "partners.profile_updated", entity: "partner", entityId: existing.id, ip });
      return ok({ status: "APPROVED" }, "اطلاعات همکار ذخیره شد.");
    default:
      return fail("حساب همکاری شما تعلیق شده است. برای پیگیری با آتم تماس بگیرید.");
  }
}
