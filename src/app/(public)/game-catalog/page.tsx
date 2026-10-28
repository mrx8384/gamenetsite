import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import { Container } from "@/components/layout/container";
import { CatalogPreview, CatalogPreviewSkeleton } from "@/components/home/catalog-preview";

export const metadata: Metadata = pageMetadata({ title: "کاتالوگ بازی‌های PS4 و PS5", description: "فهرست کامل بازی‌های PS4 و PS5 قابل اجرا در گیم‌نت اتم، با جست‌وجو و دسته‌بندی.", path: "/game-catalog" });

export default function GameCatalogPage() {
  return (
    <Container className="py-8 sm:py-12">
      <div className="mb-8 space-y-2">
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />
          کاتالوگ بازی‌ها
        </h1>
        <p className="text-muted-foreground">کنسول موردنظر را انتخاب کنید تا بازی‌های موجود را ببینید.</p>
      </div>
      <Suspense fallback={<CatalogPreviewSkeleton />}>
        <CatalogPreview />
      </Suspense>
    </Container>
  );
}
