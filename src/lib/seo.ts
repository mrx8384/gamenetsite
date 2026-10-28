import type { Metadata } from "next";
import { siteConfig } from "@/lib/brand";

/** Brand name in titles: Persian first, because most searches are in Persian. */
export const SEO_SITE_NAME = siteConfig.nameFa;
export const SEO_TITLE_SUFFIX = ` | ${SEO_SITE_NAME}`;

const DEFAULT_IMAGE = { url: siteConfig.logo.small, width: 256, height: 256, alt: siteConfig.nameFa };

/** Site-relative path with each segment percent-encoded (Persian slugs). */
export function seoPath(...segments: string[]): string {
  return "/" + segments.filter(Boolean).map(encodeURIComponent).join("/");
}

interface PageSeo {
  /** Page title without the site name (the layout template adds it). */
  title: string;
  /** Full title used as is (homepage). */
  absoluteTitle?: string;
  description?: string;
  /** Canonical path, e.g. "/shop" or seoPath("shop", slug). Query strings never belong here. */
  path: string;
  /** Site-relative image URL (product photo, news cover). Defaults to the logo. */
  image?: string;
  type?: "website" | "article";
  publishedTime?: Date | null;
  modifiedTime?: Date | null;
}

/**
 * Metadata for a public page: title, description, canonical URL and a complete Open Graph block.
 * A page's `openGraph` replaces the layout's whole block (Next merges only top-level keys), so it is
 * rebuilt here instead of setting just the image.
 */
export function pageMetadata(p: PageSeo): Metadata {
  const fullTitle = p.absoluteTitle ?? `${p.title}${SEO_TITLE_SUFFIX}`;
  const images = p.image ? [{ url: p.image, alt: p.title }] : [DEFAULT_IMAGE];
  return {
    title: p.absoluteTitle ? { absolute: p.absoluteTitle } : p.title,
    ...(p.description ? { description: p.description } : {}),
    alternates: { canonical: p.path },
    openGraph: {
      type: p.type ?? "website",
      locale: "fa_IR",
      siteName: SEO_SITE_NAME,
      url: p.path,
      title: fullTitle,
      ...(p.description ? { description: p.description } : {}),
      images,
      ...(p.type === "article" && p.publishedTime ? { publishedTime: p.publishedTime.toISOString() } : {}),
      ...(p.type === "article" && p.modifiedTime ? { modifiedTime: p.modifiedTime.toISOString() } : {}),
    },
    twitter: { card: p.image ? "summary_large_image" : "summary", title: fullTitle, ...(p.description ? { description: p.description } : {}), images: images.map((i) => i.url) },
  };
}

/** Shortens text for a meta description (search engines show ~155 characters). */
export function metaDescription(text: string | null | undefined, max = 160): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** BreadcrumbList structured data; `items` are [name, site-relative path] from the homepage down. */
export function breadcrumbJsonLd(origin: string, items: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [["خانه", "/"] as [string, string], ...items].map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: new URL(path, origin).toString(),
    })),
  };
}

/** Safe inline JSON-LD (no `</script>` break-out). */
export function jsonLdHtml(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
