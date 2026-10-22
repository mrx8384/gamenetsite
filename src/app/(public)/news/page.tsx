import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { NewsGridSkeleton } from "@/components/home/latest-news";
import { Container } from "@/components/layout/container";
import { NewsCard } from "@/components/news/news-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { getNewsCategories, getNewsList, NEWS_PAGE_SIZE } from "@/features/news/queries";
import { formatDate, formatNumber } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "اخبار", description: "اخبار دنیای بازی و رویدادهای آتم گیم کلاب" };

type SP = Record<string, string | string[] | undefined>;

export default function NewsPage({ searchParams }: PageProps<"/news">) {
  return (
    <Container className="py-8 sm:py-12">
      <h1 className="mb-8 flex items-center gap-3 text-3xl font-black">
        <span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />
        اخبار
      </h1>
      <Suspense fallback={<NewsGridSkeleton />}>
        <NewsContent searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function NewsContent({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? "";
  const category = one("category").slice(0, 100) || null;
  const page = Math.min(500, Math.max(1, Number.parseInt(one("page"), 10) || 1));
  const [categories, { items, total, featured }] = await Promise.all([getNewsCategories(), getNewsList({ category, page })]);
  const list = featured ? items.filter((i) => i.id !== featured.id) : items;
  const pages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
  const href = (p: number, c = category) => {
    const q = new URLSearchParams();
    if (c) q.set("category", c);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/news?${s}` : "/news";
  };

  return (
    <div className="space-y-8">
      {categories.length > 0 ? (
        <nav aria-label="دسته‌های اخبار" className="flex gap-2 overflow-x-auto pb-1">
          {[{ slug: null as string | null, name: "همه" }, ...categories.filter((c) => c.count > 0)].map((c) => (
            <Link
              key={c.slug ?? "all"}
              href={href(1, c.slug)}
              aria-current={category === c.slug ? "page" : undefined}
              className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors", category === c.slug ? "border-brand-green bg-brand-green/10 font-semibold" : "bg-surface hover:bg-secondary")}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {featured ? (
        <Link href={`/news/${encodeURIComponent(featured.slug)}`} className="group grid overflow-hidden rounded-2xl border bg-surface shadow-card md:grid-cols-2">
          <div className="relative aspect-[16/10] bg-secondary md:aspect-auto">
            {featured.coverKey ? <Image src={mediaUrl(featured.coverKey)} alt="" fill unoptimized priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" /> : null}
          </div>
          <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
            <span className="text-xs font-semibold text-link">خبر ویژه{featured.categoryName ? ` · ${featured.categoryName}` : ""}</span>
            <h2 className="text-2xl leading-[1.6] font-black group-hover:text-link">{featured.title}</h2>
            {featured.excerpt ? <p className="line-clamp-3 leading-8 text-muted-foreground">{featured.excerpt}</p> : null}
            {featured.publishedAt ? <time className="text-xs text-muted-foreground" dateTime={featured.publishedAt.toISOString()}>{formatDate(featured.publishedAt)}</time> : null}
          </div>
        </Link>
      ) : null}

      {list.length === 0 && !featured ? (
        <EmptyState icon={Newspaper} title="هنوز خبری منتشر نشده" description={category ? "در این دسته خبری نیست." : undefined} action={category ? <Button asChild variant="outline"><Link href="/news">همهٔ اخبار</Link></Button> : undefined} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((n) => <NewsCard key={n.id} post={n} />)}
        </div>
      )}

      {pages > 1 ? (
        <nav aria-label="صفحه‌بندی" className="flex items-center justify-center gap-2">
          {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={href(page - 1)}>قبلی</Link></Button> : null}
          <span className="px-3 text-sm text-muted-foreground">صفحهٔ {formatNumber(page)} از {formatNumber(pages)}</span>
          {page < pages ? <Button asChild variant="outline" size="sm"><Link href={href(page + 1)}>بعدی</Link></Button> : null}
        </nav>
      ) : null}
    </div>
  );
}
