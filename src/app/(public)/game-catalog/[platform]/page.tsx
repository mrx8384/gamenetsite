import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { CatalogBrowser } from "@/components/game-catalog/catalog-browser";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";
import { platformFromSlug } from "@/features/game-catalog/constants";
import { getCatalogPlatform } from "@/features/game-catalog/queries";

export function generateStaticParams() {
  return [{ platform: "ps4" }, { platform: "ps5" }];
}

export async function generateMetadata({ params }: PageProps<"/game-catalog/[platform]">): Promise<Metadata> {
  const platform = platformFromSlug((await params).platform);
  if (!platform) return { title: "پیدا نشد" };
  return pageMetadata({ title: `بازی‌های ${platform}`, description: `فهرست بازی‌های ${platform} قابل اجرا در گیم‌نت اتم گیم کلاب؛ جست‌وجو بر اساس نام و دسته‌بندی.`, path: `/game-catalog/${platform.toLowerCase()}` });
}

export default function PlatformCatalogPage({ params }: PageProps<"/game-catalog/[platform]">) {
  return (
    <Container className="py-6 sm:py-10">
      <Link href="/game-catalog" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> کاتالوگ بازی‌ها
      </Link>
      <Suspense fallback={<CatalogSkeleton />}>
        <PlatformCatalog params={params} />
      </Suspense>
    </Container>
  );
}

async function PlatformCatalog({ params }: { params: Promise<{ platform: string }> }) {
  const platform = platformFromSlug((await params).platform);
  if (!platform) notFound();
  await connection();
  const data = await getCatalogPlatform(platform);
  return <CatalogBrowser platform={platform} categories={data.categories} games={data.games} />;
}

function CatalogSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="در حال بارگذاری">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
