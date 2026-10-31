"use server";

import { updateTag } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { SECTIONS_KEY } from "./sections";
import { sectionVisibilitySchema } from "./sections-schema";

export async function saveSectionVisibility(input: unknown): Promise<ActionResult<undefined>> {
  let userId: string;
  try {
    userId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return fail("دسترسی غیرمجاز.");
    throw e;
  }
  const parsed = sectionVisibilitySchema.safeParse(input);
  if (!parsed.success) return fail("اطلاعات نامعتبر است.");
  await db.siteSetting.upsert({ where: { key: SECTIONS_KEY }, create: { key: SECTIONS_KEY, value: parsed.data }, update: { value: parsed.data } });
  // Menus, homepage sections and the page gates all read this through the settings cache.
  updateTag(CACHE_TAGS.settings);
  const hidden = Object.entries(parsed.data).filter(([, v]) => !v).map(([k]) => k);
  await audit({ actorId: userId, action: "settings.sections_updated", entity: "site_setting", entityId: SECTIONS_KEY, meta: { hidden } });
  return ok(undefined, "تنظیمات نمایش بخش‌ها ذخیره شد.");
}
