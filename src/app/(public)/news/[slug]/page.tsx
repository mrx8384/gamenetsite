import type { Metadata } from "next";
import { breadcrumbJsonLd, jsonLdHtml, metaDescription, pageMetadata, seoPath } from "@/lib/seo";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SectionHeading } from "@/components/home/section-heading";
import { Container } from "@/components/layout/container";
import { NewsCard } from "@/components/news/news-card";
import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { Skeleton } from "@/components/ui/skeleton";
import { getNewsBySlug, getRelatedNews } from "@/features/news/queries";
import { siteConfig } from "@/lib/brand";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const post = await getNewsBySlug(decode((await params).slug));
  if (!post) return { title: "خبر پیدا نشد" };
  return pageMetadata({
    title: post.title,
    description: metaDescription(post.excerpt),
    path: seoPath("news", post.slug),
    image: post.coverKey ? mediaUrl(post.coverKey) : undefined,
    type: "article",
    publishedTime: post.publishedAt,
    modifiedTime: post.updatedAt,
  });
}

export default function NewsArticlePage({ params }: PageProps<"/news/[slug]">) {
  return (
    <Container className="py-8 sm:py-12">
      <Suspense fallback={<div className="mx-auto max-w-3xl space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="aspect-[16/9] w-full" /><Skeleton className="h-40 w-full" /></div>}>
        <Article params={params} />
      </Suspense>
    </Container>
  );
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getNewsBySlug(decode((await params).slug));
  if (!post) notFound();
  const related = await getRelatedNews(post.id, post.categorySlug);
  const url = new URL(seoPath("news", post.slug), env.APP_URL).toString();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    image: post.coverKey ? [new URL(mediaUrl(post.coverKey), env.APP_URL).toString()] : undefined,
    mainEntityOfPage: url,
    author: post.authorName ? { "@type": "Person", name: post.authorName } : { "@type": "Organization", name: siteConfig.name, url: new URL("/", env.APP_URL).toString() },
    publisher: { "@type": "Organization", name: siteConfig.name, logo: { "@type": "ImageObject", url: new URL(siteConfig.logo.small, env.APP_URL).toString() } },
  };
  const crumbs: [string, string][] = [["اخبار", "/news"]];
  if (post.categorySlug && post.categoryName) crumbs.push([post.categoryName, `/news?category=${encodeURIComponent(post.categorySlug)}`]);
  crumbs.push([post.title, seoPath("news", post.slug)]);
  const breadcrumbs = breadcrumbJsonLd(env.APP_URL, crumbs);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml([jsonLd, breadcrumbs]) }} />
      <article className="mx-auto max-w-3xl">
        <nav aria-label="مسیر" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link href="/news" className="hover:text-foreground">اخبار</Link>
          {post.categorySlug ? (<><ChevronLeft className="size-4" aria-hidden /><Link href={`/news?category=${encodeURIComponent(post.categorySlug)}`} className="hover:text-foreground">{post.categoryName}</Link></>) : null}
        </nav>
        <h1 className="text-3xl leading-[1.6] font-black sm:text-4xl">{post.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {post.publishedAt ? <time dateTime={post.publishedAt.toISOString()}>{formatDate(post.publishedAt)}</time> : null}
          {post.authorName ? <> · {post.authorName}</> : null}
        </p>
        {post.coverKey ? (
          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-2xl bg-secondary">
            <Image src={mediaUrl(post.coverKey)} alt="" fill unoptimized priority sizes="(min-width: 768px) 768px, 100vw" className="object-cover" />
          </div>
        ) : null}
        <RichTextContent html={post.contentHtml} className="mt-8 text-[1.05rem]" />
      </article>
      {related.length > 0 ? (
        <section className="mx-auto mt-16 max-w-6xl">
          <SectionHeading title="اخبار مرتبط" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{related.map((n) => <NewsCard key={n.id} post={n} />)}</div>
        </section>
      ) : null}
    </>
  );
}
