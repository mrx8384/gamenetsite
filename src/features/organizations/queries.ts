import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

export interface PublicOrganization {
  id: string;
  name: string;
  logoKey: string | null;
  description: string | null;
  terms: string | null;
  website: string | null;
  showDetails: boolean;
}

/** Active organizations for the homepage strip, in admin order. */
export async function getActiveOrganizations(): Promise<PublicOrganization[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.organizations);
  const rows = await db.contractOrganization.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, description: true, terms: true, website: true, showDetails: true, logo: { select: { storageKey: true } } },
    take: 100,
  });
  return rows.map(({ logo, ...o }) => ({ ...o, logoKey: logo?.storageKey ?? null }));
}

/** Everything for the admin page. */
export function getAllOrganizations() {
  return db.contractOrganization.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { logo: { select: { id: true, storageKey: true } } },
  });
}
