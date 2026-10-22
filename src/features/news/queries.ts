import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";

export interface NewsCardData {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  coverKey: string | null;
  categoryName: string | null;
}

/** Latest published posts. Drafts are never returned. */
export async function getLatestNews(limit = 3): Promise<NewsCardData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.news);

  const rows = await db.newsPost.findMany({
    where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      cover: { select: { storageKey: true } },
      category: { select: { name: true } },
    },
  });

  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    slug: n.slug,
    excerpt: n.excerpt,
    publishedAt: n.publishedAt,
    coverKey: n.cover?.storageKey ?? null,
    categoryName: n.category?.name ?? null,
  }));
}
