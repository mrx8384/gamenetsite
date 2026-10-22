import { Suspense } from "react";
import { AboutTeaser } from "@/components/home/about-teaser";
import { CatalogPreview, CatalogPreviewSkeleton } from "@/components/home/catalog-preview";
import { FeaturedProducts, ProductGridSkeleton } from "@/components/home/featured-products";
import { Hero } from "@/components/home/hero";
import { LatestNews, NewsGridSkeleton } from "@/components/home/latest-news";
import { PartnerServices } from "@/components/home/partner-services";
import { SectionHeading } from "@/components/home/section-heading";
import { TournamentBand } from "@/components/home/tournament-band";
import { Container } from "@/components/layout/container";
import { homeContent } from "@/content/home";

export default function HomePage() {
  const c = homeContent;
  return (
    <>
      <Hero />

      <Container className="py-14 sm:py-20">
        <SectionHeading title={c.shop.title} subtitle={c.shop.subtitle} href="/shop" />
        <Suspense fallback={<ProductGridSkeleton />}>
          <FeaturedProducts />
        </Suspense>
      </Container>

      <section className="border-y bg-secondary/50">
        <Container className="py-14 sm:py-20">
          <SectionHeading title={c.catalog.title} subtitle={c.catalog.subtitle} href="/game-catalog" />
          <Suspense fallback={<CatalogPreviewSkeleton />}>
            <CatalogPreview />
          </Suspense>
        </Container>
      </section>

      <TournamentBand />

      <Container className="py-14 sm:py-20">
        <PartnerServices />
      </Container>

      <section className="border-y bg-secondary/50">
        <Container className="py-14 sm:py-20">
          <SectionHeading title={c.news.title} subtitle={c.news.subtitle} href="/news" />
          <Suspense fallback={<NewsGridSkeleton />}>
            <LatestNews />
          </Suspense>
        </Container>
      </section>

      <Container className="py-14 sm:py-20">
        <AboutTeaser />
      </Container>
    </>
  );
}
