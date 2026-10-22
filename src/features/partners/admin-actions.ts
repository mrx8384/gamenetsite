"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { reviewReasonSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

type Decision = "approve" | "reject" | "suspend";
const ALLOWED_FROM: Record<Decision, string[]> = {
  approve: ["PENDING", "REJECTED", "SUSPENDED"],
  reject: ["PENDING"],
  suspend: ["APPROVED"],
};

/**
 * Review decision. The PARTNER role always mirrors an APPROVED profile and is changed in the same
 * transaction (admins keep their ADMIN role). Sessions read the role from the DB on every request,
 * so the change applies immediately without logging the user out.
 */
export async function reviewPartner(profileId: string, decision: Decision, reason?: unknown): Promise<ActionResult<undefined>> {
  const actor = await admin();
  if (!actor) return fail("دسترسی غیرمجاز.");
  if (typeof profileId !== "string" || !(decision in ALLOWED_FROM)) return fail("درخواست نامعتبر است.");

  let note: string | null = null;
  if (decision !== "approve") {
    const r = reviewReasonSchema.safeParse(reason);
    if (!r.success) return fail(r.error.issues[0]?.message ?? "دلیل را وارد کنید.", { reason: r.error.issues[0]?.message ?? "" });
    note = r.data;
  }

  const result = await db.$transaction(async (tx) => {
    const profile = await tx.partnerProfile.findUnique({ where: { id: profileId }, select: { status: true, userId: true, user: { select: { role: true } } } });
    if (!profile) return "not-found" as const;
    if (!ALLOWED_FROM[decision].includes(profile.status)) return "bad-state" as const;
    const status = decision === "approve" ? "APPROVED" : decision === "reject" ? "REJECTED" : "SUSPENDED";
    await tx.partnerProfile.update({
      where: { id: profileId },
      data: { status, reviewedById: actor.id, reviewedAt: new Date(), rejectionReason: note },
    });
    if (profile.user.role !== "ADMIN") {
      await tx.user.update({ where: { id: profile.userId }, data: { role: status === "APPROVED" ? "PARTNER" : "USER" } });
    }
    return { from: profile.status, to: status };
  });
  if (result === "not-found") return fail("درخواست پیدا نشد.");
  if (result === "bad-state") return fail("این تغییر وضعیت برای وضعیت فعلی مجاز نیست. صفحه را تازه کنید.");

  const { ip } = await getRequestInfo();
  await audit({ actorId: actor.id, action: { approve: "partners.approved", reject: "partners.rejected", suspend: "partners.suspended" }[decision], entity: "partner", entityId: profileId, ip, meta: { ...result, reason: note } });
  revalidatePath("/admin/partners");
  revalidatePath(`/admin/partners/${profileId}`);
  const msg = { approve: "همکار تأیید شد.", reject: "درخواست رد شد.", suspend: "همکار تعلیق شد." }[decision];
  return ok(undefined, msg);
}
