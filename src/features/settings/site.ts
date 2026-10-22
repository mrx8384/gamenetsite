import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { groupDefaults, groupSchema, type SiteGroupKey, type SiteGroupValues } from "./site-schema";

/**
 * Saved values merged over defaults. Empty strings are kept as "" for optional contact fields,
 * but required texts (non-empty defaults) fall back to their default when cleared.
 */
export async function getSiteSettings<G extends SiteGroupKey>(group: G): Promise<SiteGroupValues<G>> {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.settings);
  const defaults = groupDefaults(group);
  const row = await db.siteSetting.findUnique({ where: { key: `site.${group}` } });
  const parsed = groupSchema(group).partial().safeParse(row?.value ?? {});
  const saved = (parsed.success ? parsed.data : {}) as Record<string, string | undefined>;
  const out: Record<string, string> = { ...defaults };
  for (const [k, def] of Object.entries(defaults)) {
    const v = saved[k];
    if (typeof v === "string" && (v !== "" || def === "")) out[k] = v;
  }
  return out as SiteGroupValues<G>;
}
