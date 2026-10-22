"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { getRequestInfo } from "@/lib/request-info";
import { renderRichText } from "@/lib/rich-text/render";
import { EDITABLE_PAGES } from "./queries";

const schema = z.object({ title: z.string().trim().min(2, "عنوان را وارد کنید").max(200), content: z.unknown() });

export async function savePage(slug: unknown, input: unknown): Promise<ActionResult<undefined>> {
  let userId: string;
  try {
    userId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("دسترسی غیرمجاز.");
    throw e;
  }
  if (typeof slug !== "string" || !(slug in EDITABLE_PAGES)) return fail("صفحه نامعتبر است.");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("لطفاً خطاهای فرم را برطرف کنید.", zodFieldErrors(parsed.error.issues));
  const rendered = renderRichText(parsed.data.content);
  if (!rendered) return fail("محتوای صفحه نامعتبر است.");
  const data = { title: parsed.data.title, contentJson: rendered.json as unknown as Prisma.InputJsonValue, contentHtml: rendered.html, updatedById: userId };
  await db.page.upsert({ where: { slug }, create: { slug, ...data }, update: data });
  const { ip } = await getRequestInfo();
  await audit({ actorId: userId, action: "pages.updated", entity: "page", entityId: slug, ip });
  updateTag(CACHE_TAGS.settings);
  return ok(undefined, "صفحه ذخیره شد.");
}
