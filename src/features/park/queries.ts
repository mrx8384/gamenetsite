import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { mediaUrl } from "@/lib/media";
import { staticImageUrl } from "./schemas";

export { staticImageUrl };

export interface PublicAttraction {
  id: string;
  title: string;
  description: string;
  /** Site-relative image URL (uploaded image first, else the built-in photo), or null. */
  image: string | null;
}

export async function getActiveAttractions(): Promise<PublicAttraction[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.park);
  const rows = await db.parkAttraction.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, description: true, staticImage: true, image: { select: { storageKey: true } } },
    take: 50,
  });
  return rows.map((r) => ({ id: r.id, title: r.title, description: r.description, image: r.image ? mediaUrl(r.image.storageKey) : staticImageUrl(r.staticImage) }));
}

export function getAllAttractions() {
  return db.parkAttraction.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { image: { select: { id: true, storageKey: true } } } });
}
