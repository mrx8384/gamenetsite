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

// ───────────── Public list & detail ─────────────

export const NEWS_PAGE_SIZE = 9;

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  publishedAt: true,
  cover: { select: { storageKey: true } },
  category: { select: { name: true } },
} as const;

type CardRow = { id: string; title: string; slug: string; excerpt: string | null; publishedAt: Date | null; cover: { storageKey: string } | null; category: { name: string } | null };
const toCard = (n: CardRow): NewsCardData => ({
  id: n.id, title: n.title, slug: n.slug, excerpt: n.excerpt, publishedAt: n.publishedAt, coverKey: n.cover?.storageKey ?? null, categoryName: n.category?.name ?? null,
});

export async function getNewsCategories(): Promise<{ id: string; name: string; slug: string; count: number }[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.news);
  const rows = await db.newsCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, _count: { select: { posts: { where: { status: "PUBLISHED" } } } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, count: r._count.posts }));
}

export async function getNewsList(filters: { category: string | null; page: number }): Promise<{ items: NewsCardData[]; total: number; featured: NewsCardData | null }> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.news);
  const where = {
    status: "PUBLISHED" as const,
    publishedAt: { lte: new Date() },
    ...(filters.category ? { category: { slug: filters.category } } : {}),
  };
  const [total, rows, featured] = await Promise.all([
    db.newsPost.count({ where }),
    db.newsPost.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (filters.page - 1) * NEWS_PAGE_SIZE, take: NEWS_PAGE_SIZE, select: cardSelect }),
    filters.page === 1 && !filters.category
      ? db.newsPost.findFirst({ where: { ...where, isFeatured: true }, orderBy: { publishedAt: "desc" }, select: cardSelect })
      : Promise.resolve(null),
  ]);
  return { total, items: rows.map(toCard), featured: featured ? toCard(featured) : null };
}

export interface NewsDetail extends NewsCardData {
  contentHtml: string;
  updatedAt: Date;
  authorName: string | null;
  categorySlug: string | null;
}

export async function getNewsBySlug(slug: string): Promise<NewsDetail | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.news);
  const n = await db.newsPost.findFirst({
    where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } },
    select: { ...cardSelect, contentHtml: true, updatedAt: true, author: { select: { name: true } }, category: { select: { name: true, slug: true } } },
  });
  if (!n) return null;
  return { ...toCard(n), contentHtml: n.contentHtml, updatedAt: n.updatedAt, authorName: n.author?.name ?? null, categorySlug: n.category?.slug ?? null };
}

export async function getRelatedNews(id: string, categorySlug: string | null, limit = 3): Promise<NewsCardData[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.news);
  const rows = await db.newsPost.findMany({
    where: { status: "PUBLISHED", publishedAt: { lte: new Date() }, id: { not: id }, ...(categorySlug ? { category: { slug: categorySlug } } : {}) },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}
