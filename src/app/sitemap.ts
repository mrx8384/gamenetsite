import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getSectionVisibility } from "@/features/settings/sections";
import { visibleLinks } from "@/features/settings/sections-schema";

/** Public pages + active products + published news + public tournaments. Rendered per request (no DB needed at build). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = env.APP_URL.replace(/\/+$/, "");
  const show = await getSectionVisibility();
  const [products, posts, tournaments] = await Promise.all([
    show.shop ? db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 5000 }) : [],
    show.news ? db.newsPost.findMany({ where: { status: "PUBLISHED", publishedAt: { lte: new Date() } }, select: { slug: true, updatedAt: true }, orderBy: { publishedAt: "desc" }, take: 5000 }) : [],
    show.tournaments ? db.tournament.findMany({ where: { status: { in: ["REGISTRATION", "IN_PROGRESS", "COMPLETED"] } }, select: { slug: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 2000 }) : [],
  ]);
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/game-catalog`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/game-catalog/ps4`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/game-catalog/ps5`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/news`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/partners`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/tournaments`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/amusement-park`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/atom-world`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/tournaments/gamepad-tester`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.5 },
  ];
  // Hidden sections (Admin → تنظیمات سایت → نمایش بخش‌ها) are left out.
  const kept = new Set(visibleLinks(staticPages.map((p) => ({ href: new URL(p.url).pathname })), show).map((l) => l.href));
  const visibleStatic = staticPages.filter((p) => kept.has(new URL(p.url).pathname));
  return [
    ...visibleStatic,
    ...products.map((p) => ({ url: `${base}/shop/${encodeURIComponent(p.slug)}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${base}/news/${encodeURIComponent(p.slug)}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.6 })),
    ...tournaments.map((t) => ({ url: `${base}/tournaments/${encodeURIComponent(t.slug)}`, lastModified: t.updatedAt, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
