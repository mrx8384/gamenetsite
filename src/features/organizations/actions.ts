"use server";

import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { deleteUnusedMedia } from "@/features/media/storage";
import { organizationSchema } from "./schemas";

async function admin() {
  try {
    return (await assertRole(["ADMIN"])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 40;
const NOT_FOUND = "سازمان پیدا نشد.";

export async function saveOrganization(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = organizationSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات را بررسی کنید.", zodFieldErrors(parsed.error.issues));
  const data = parsed.data;
  if (data.logoId && !(await db.media.findUnique({ where: { id: data.logoId }, select: { id: true } }))) {
    return fail("لوگو پیدا نشد؛ دوباره بارگذاری کنید.", { logoId: "لوگو پیدا نشد." });
  }

  let orgId: string;
  let oldLogo: string | null = null;
  if (id === null) {
    const last = await db.contractOrganization.aggregate({ _max: { sortOrder: true } });
    orgId = (await db.contractOrganization.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1 } })).id;
  } else {
    if (!validId(id)) return fail(NOT_FOUND);
    const before = await db.contractOrganization.findUnique({ where: { id }, select: { logoId: true } });
    if (!before) return fail(NOT_FOUND);
    await db.contractOrganization.update({ where: { id }, data });
    orgId = id;
    oldLogo = before.logoId !== data.logoId ? before.logoId : null;
  }
  if (oldLogo) await deleteUnusedMedia([oldLogo]);
  updateTag(CACHE_TAGS.organizations);
  await audit({ actorId: user.id, action: id === null ? "organization.created" : "organization.updated", entity: "contract_organization", entityId: orgId, meta: { name: data.name } });
  return ok({ id: orgId }, id === null ? "سازمان اضافه شد." : "تغییرات ذخیره شد.");
}

export async function deleteOrganization(id: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (!validId(id)) return fail(NOT_FOUND);
  const org = await db.contractOrganization.findUnique({ where: { id }, select: { name: true, logoId: true } });
  if (!org) return fail(NOT_FOUND);
  await db.contractOrganization.delete({ where: { id } });
  if (org.logoId) await deleteUnusedMedia([org.logoId]);
  updateTag(CACHE_TAGS.organizations);
  await audit({ actorId: user.id, action: "organization.deleted", entity: "contract_organization", entityId: id, meta: { name: org.name } });
  return ok(undefined, "سازمان حذف شد.");
}

/** Swaps the order with the neighbour before/after. */
export async function moveOrganization(id: unknown, direction: unknown): Promise<ActionResult<undefined>> {
  const user = await admin();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (!validId(id) || (direction !== "up" && direction !== "down")) return fail("درخواست نامعتبر است.");
  await db.$transaction(async (tx) => {
    const all = await tx.contractOrganization.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const i = all.findIndex((o) => o.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    for (const [n, o] of all.entries()) await tx.contractOrganization.update({ where: { id: o.id }, data: { sortOrder: n + 1 } });
  });
  updateTag(CACHE_TAGS.organizations);
  return ok(undefined);
}
