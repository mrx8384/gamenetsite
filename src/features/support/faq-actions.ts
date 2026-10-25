"use server";

import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, RATE_LIMIT_ERROR, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";
import { SUPPORT_STAFF_ROLES } from "./constants";
import { faqSchema } from "./faq-schemas";

async function staff() {
  try {
    return (await assertRole([...SUPPORT_STAFF_ROLES])).user;
  } catch (e) {
    if (e instanceof AuthorizationError) return null;
    throw e;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 40;

export async function saveFaq(id: unknown, input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await staff();
  if (!user) return fail("دسترسی غیرمجاز.");
  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات را بررسی کنید.", zodFieldErrors(parsed.error.issues));

  let faqId: string;
  if (id === null) {
    const last = await db.supportFaq.aggregate({ _max: { sortOrder: true } });
    faqId = (await db.supportFaq.create({ data: { ...parsed.data, sortOrder: (last._max.sortOrder ?? 0) + 1 } })).id;
  } else {
    if (!validId(id)) return fail("سؤال پیدا نشد.");
    const { count } = await db.supportFaq.updateMany({ where: { id }, data: parsed.data });
    if (!count) return fail("سؤال پیدا نشد.");
    faqId = id;
  }
  updateTag(CACHE_TAGS.faq);
  await audit({ actorId: user.id, action: id === null ? "faq.created" : "faq.updated", entity: "support_faq", entityId: faqId });
  return ok({ id: faqId }, id === null ? "سؤال اضافه شد." : "تغییرات ذخیره شد.");
}

export async function deleteFaq(id: unknown): Promise<ActionResult<undefined>> {
  const user = await staff();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (!validId(id)) return fail("سؤال پیدا نشد.");
  const { count } = await db.supportFaq.deleteMany({ where: { id } });
  if (!count) return fail("سؤال پیدا نشد.");
  updateTag(CACHE_TAGS.faq);
  await audit({ actorId: user.id, action: "faq.deleted", entity: "support_faq", entityId: id });
  return ok(undefined, "سؤال حذف شد.");
}

/** Swaps the order with the neighbour above/below. */
export async function moveFaq(id: unknown, direction: unknown): Promise<ActionResult<undefined>> {
  const user = await staff();
  if (!user) return fail("دسترسی غیرمجاز.");
  if (!validId(id) || (direction !== "up" && direction !== "down")) return fail("درخواست نامعتبر است.");
  await db.$transaction(async (tx) => {
    const all = await tx.supportFaq.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const i = all.findIndex((f) => f.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= all.length) return;
    [all[i], all[j]] = [all[j], all[i]];
    // Renumber everything so equal/legacy sort values can't block a move.
    for (const [n, f] of all.entries()) await tx.supportFaq.update({ where: { id: f.id }, data: { sortOrder: n + 1 } });
  });
  updateTag(CACHE_TAGS.faq);
  return ok(undefined);
}

/** Public, anonymous: counts how often a suggested answer was opened / marked helpful. */
export async function recordFaqFeedback(id: unknown, kind: unknown): Promise<ActionResult<undefined>> {
  if (!validId(id) || (kind !== "open" && kind !== "helpful")) return fail("درخواست نامعتبر است.");
  const { ip } = await getRequestInfo();
  if (!(await rateLimit(`faq:feedback:${ip}`, 30, 60)).allowed) return fail(RATE_LIMIT_ERROR);
  await db.supportFaq.updateMany({
    where: { id, isActive: true },
    data: kind === "open" ? { openCount: { increment: 1 } } : { helpfulCount: { increment: 1 } },
  });
  return ok(undefined);
}
