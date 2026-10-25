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
import { getSiteSettings } from "@/features/settings/site";
import { env } from "@/lib/env";

export default async function HomePage() {
  const c = await getSiteSettings("home");
  const origin = new URL(env.APP_URL).origin;
  // Site name and logo for search results (WebSite + Organization structured data).
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "ATOM GAME CLUB", alternateName: ["آتم گیم کلاب", "Atom Game Club"], url: `${origin}/` },
    { "@context": "https://schema.org", "@type": "Organization", name: "ATOM GAME CLUB", alternateName: "آتم گیم کلاب", url: `${origin}/`, logo: `${origin}/brand/atom-logo-256.png` },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Hero eyebrow={c.heroEyebrow} title={c.heroTitle} subtitle={c.heroSubtitle} />

      <Container className="py-14 sm:py-20">
        <SectionHeading title={c.shopTitle} subtitle={c.shopSubtitle} href="/shop" />
        <Suspense fallback={<ProductGridSkeleton />}>
          <FeaturedProducts />
        </Suspense>
      </Container>

      <section className="border-y bg-secondary/50">
        <Container className="py-14 sm:py-20">
          <SectionHeading title={c.catalogTitle} subtitle={c.catalogSubtitle} href="/game-catalog" />
          <Suspense fallback={<CatalogPreviewSkeleton />}>
            <CatalogPreview />
          </Suspense>
        </Container>
      </section>

      <TournamentBand title={c.tournamentsTitle} subtitle={c.tournamentsSubtitle} />

      <Container className="py-14 sm:py-20">
        <PartnerServices
          title={c.partnersTitle}
          subtitle={c.partnersSubtitle}
          points={[
            { title: c.partner1Title, body: c.partner1Body },
            { title: c.partner2Title, body: c.partner2Body },
            { title: c.partner3Title, body: c.partner3Body },
          ]}
        />
      </Container>

      <section className="border-y bg-secondary/50">
        <Container className="py-14 sm:py-20">
          <SectionHeading title={c.newsTitle} subtitle={c.newsSubtitle} href="/news" />
          <Suspense fallback={<NewsGridSkeleton />}>
            <LatestNews />
          </Suspense>
        </Container>
      </section>

      <Container className="py-14 sm:py-20">
        <AboutTeaser title={c.aboutTitle} body={c.aboutBody} />
      </Container>
    </>
  );
}
