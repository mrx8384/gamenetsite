import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const EDITABLE_PAGES = { about: "درباره ما" } as const;
export type EditablePage = keyof typeof EDITABLE_PAGES;

export async function getPage(slug: EditablePage): Promise<{ title: string; contentHtml: string; contentJson: unknown; updatedAt: Date | null } | null> {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.settings);
  const page = await db.page.findUnique({ where: { slug }, select: { title: true, contentHtml: true, contentJson: true, updatedAt: true } });
  return page;
}
