import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { SECTION_KEYS, sectionVisibilitySchema, type SectionVisibility } from "./sections-schema";

export const SECTIONS_KEY = "sections";

/** Which public sections are shown (all on until the admin hides one). */
export async function getSectionVisibility(): Promise<SectionVisibility> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.settings);
  const row = await db.siteSetting.findUnique({ where: { key: SECTIONS_KEY } });
  const parsed = sectionVisibilitySchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : sectionVisibilitySchema.parse({});
}

export { SECTION_KEYS };
