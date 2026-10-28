import type { Metadata } from "next";
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
import { toEnglishDigits } from "@/lib/format";
import { jsonLdHtml, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const g = await getSiteSettings("general");
  return pageMetadata({ title: g.homeTitle, absoluteTitle: g.homeTitle, description: g.siteDescription, path: "/" });
}

const SOCIAL_KEYS = ["instagram", "telegram", "whatsapp", "eitaa", "bale", "aparat", "youtube"] as const;

export default async function HomePage() {
  const [c, contact, general] = await Promise.all([getSiteSettings("home"), getSiteSettings("contact"), getSiteSettings("general")]);
  const origin = new URL(env.APP_URL).origin;
  const phone = toEnglishDigits(contact.phone || contact.mobile).replace(/[^\d+]/g, "");
  const sameAs = SOCIAL_KEYS.map((k) => contact[k]).filter(Boolean);
  // Site name, logo and contact details for search results. With an address the club is also a local
  // business (EntertainmentBusiness ⊂ LocalBusiness), which helps searches like «گیم نت نزدیک من».
  const jsonLd = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "ATOM GAME CLUB", alternateName: ["اتم گیم کلاب", "Atom Game Club"], url: `${origin}/`, inLanguage: "fa-IR" },
    {
      "@context": "https://schema.org",
      "@type": contact.address ? "EntertainmentBusiness" : "Organization",
      "@id": `${origin}/#organization`,
      name: "ATOM GAME CLUB",
      alternateName: "اتم گیم کلاب",
      description: general.siteDescription || undefined,
      url: `${origin}/`,
      logo: `${origin}/brand/atom-logo-256.png`,
      ...(contact.address ? { image: `${origin}/brand/atom-logo.webp`, address: { "@type": "PostalAddress", streetAddress: contact.address, addressCountry: "IR" } } : {}),
      ...(phone ? { telephone: phone } : {}),
      ...(contact.email ? { email: contact.email } : {}),
      ...(contact.mapUrl ? { hasMap: contact.mapUrl } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      foundingDate: "2021",
    },
  ];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
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
