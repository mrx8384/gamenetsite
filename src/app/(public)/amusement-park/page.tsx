import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Box, Clock, MapPin, Phone, Sparkles } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getActiveAttractions, type PublicAttraction } from "@/features/park/queries";
import { getSiteSettings } from "@/features/settings/site";
import { toPersianDigits } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getSiteSettings("park");
  return pageMetadata({ title: t.title, description: t.subtitle || t.intro.slice(0, 160), path: "/amusement-park", image: "/atom-world/photos/hall-overview.webp" });
}

const two = (n: number) => toPersianDigits(String(n).padStart(2, "0"));

/** Up to three photos, overlapping like prints on a table. */
function Collage({ items }: { items: PublicAttraction[] }) {
  const photos = items.filter((a) => a.image).slice(0, 3);
  if (photos.length === 0) return null;
  const spots = ["inset-x-[8%] top-0 z-10 rotate-[-3deg]", "start-0 bottom-0 w-[58%] z-20 rotate-[4deg]", "end-0 bottom-[6%] w-[52%] z-30 rotate-[-6deg]"];
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-lg" aria-hidden>
      {photos.map((p, i) => (
        <div key={p.id} className={`absolute aspect-[4/3] overflow-hidden rounded-2xl border-4 border-surface bg-secondary shadow-[0_24px_60px_-24px_rgb(17_17_17/0.5)] ${i === 0 ? "w-[78%]" : ""} ${spots[i]}`}>
          <Image src={p.image!} alt="" fill unoptimized priority={i === 0} sizes="(min-width: 1024px) 380px, 70vw" className="object-cover" />
        </div>
      ))}
    </div>
  );
}

function AttractionRow({ item, index }: { item: PublicAttraction; index: number }) {
  const flip = index % 2 === 1;
  return (
    <article id={item.id} className="grid scroll-mt-24 grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
      <div className={flip ? "md:order-2" : undefined}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border bg-secondary shadow-card">
          {item.image ? (
            <Image src={item.image} alt={item.title} fill unoptimized sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 [background:radial-gradient(circle_at_30%_30%,color-mix(in_oklab,var(--brand-yellow)_45%,transparent),transparent_60%),radial-gradient(circle_at_75%_70%,color-mix(in_oklab,var(--brand-green)_35%,transparent),transparent_60%)]">
              <Sparkles className="size-14 text-brand-green-deep" aria-hidden />
              <span className="text-lg font-black">{item.title}</span>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <span className="inline-flex items-center gap-2 text-sm font-bold text-brand-green-deep">
          <span className="flex size-9 items-center justify-center rounded-full bg-brand-yellow text-brand-black">{two(index + 1)}</span>
          اتم گیم
        </span>
        <h3 className="text-2xl leading-[1.5] font-black sm:text-3xl">{item.title}</h3>
        <p className="leading-9 whitespace-pre-line text-muted-foreground">{item.description}</p>
      </div>
    </article>
  );
}

export default function AmusementParkPage() {
  return (
    <Suspense fallback={<ParkSkeleton />}>
      <ParkContent />
    </Suspense>
  );
}

async function ParkContent() {
  await connection();
  const [t, items, contact] = await Promise.all([getSiteSettings("park"), getActiveAttractions(), getSiteSettings("contact")]);
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background:radial-gradient(55%_60%_at_85%_30%,color-mix(in_oklab,var(--brand-yellow)_22%,transparent),transparent_70%),radial-gradient(50%_60%_at_10%_80%,color-mix(in_oklab,var(--brand-green)_16%,transparent),transparent_70%)]"
        />
        <Container className="relative grid grid-cols-1 items-center gap-12 py-14 sm:py-20 lg:grid-cols-2">
          <div className="space-y-6 text-center lg:text-start">
            <p className="inline-flex items-center gap-2 rounded-full border bg-surface/70 px-3.5 py-1.5 text-xs font-semibold">
              <span className="size-2 rounded-full bg-brand-green" aria-hidden /> ATOM GAME CLUB
            </p>
            <h1 className="text-4xl leading-[1.35] font-black sm:text-5xl">{t.title}</h1>
            {t.subtitle ? <p className="text-xl leading-9 font-bold text-foreground/80">{t.subtitle}</p> : null}
            {t.intro ? <p className="mx-auto max-w-xl leading-9 whitespace-pre-line text-muted-foreground lg:mx-0">{t.intro}</p> : null}
            <div className="flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              {/* Plain link: the 3D world needs a full page load (own CSP, fresh WebGL page). */}
              <Button asChild size="lg">
                <a href="/atom-world"><Box /> ورود به دنیای سه‌بعدی اتم گیم</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact"><MapPin /> نشانی و مسیریابی</Link>
              </Button>
            </div>
          </div>
          <Collage items={items} />
        </Container>
      </section>

      {items.length > 0 ? (
        <Container className="py-14 sm:py-20">
          <div className="mb-10 space-y-5 text-center">
            <h2 className="text-2xl font-black sm:text-3xl">{t.sectionTitle}</h2>
            <nav aria-label="بخش‌های شهربازی" className="flex flex-wrap justify-center gap-2">
              {items.map((a) => (
                <a key={a.id} href={`#${a.id}`} className="rounded-full border bg-surface px-4 py-2 text-sm font-medium transition-colors hover:border-brand-green hover:bg-brand-green/10">
                  {a.title}
                </a>
              ))}
            </nav>
          </div>
          <div className="space-y-16 sm:space-y-24">
            {items.map((a, i) => (
              <AttractionRow key={a.id} item={a} index={i} />
            ))}
          </div>
        </Container>
      ) : null}

      {contact.address || contact.hours || contact.phone ? (
        <Container className="pb-6">
          <div className="grid grid-cols-1 gap-4 rounded-2xl border bg-surface p-5 shadow-card sm:grid-cols-3 sm:p-6">
            {contact.address ? (
              <p className="flex items-start gap-3 text-sm leading-7"><MapPin className="mt-1 size-5 shrink-0 text-brand-green-deep" aria-hidden /><span><span className="block text-muted-foreground">نشانی</span>{contact.address}</span></p>
            ) : null}
            {contact.hours ? (
              <p className="flex items-start gap-3 text-sm leading-7"><Clock className="mt-1 size-5 shrink-0 text-brand-green-deep" aria-hidden /><span><span className="block text-muted-foreground">ساعات کاری</span>{contact.hours}</span></p>
            ) : null}
            {contact.phone ? (
              <p className="flex items-start gap-3 text-sm leading-7"><Phone className="mt-1 size-5 shrink-0 text-brand-green-deep" aria-hidden /><span><span className="block text-muted-foreground">تلفن</span><a href={`tel:${contact.phone}`} className="ltr hover:text-link">{toPersianDigits(contact.phone)}</a></span></p>
            ) : null}
          </div>
        </Container>
      ) : null}

      <Container className="py-14 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-black px-6 py-12 text-center text-brand-cream sm:px-12">
          <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(45%_70%_at_15%_20%,color-mix(in_oklab,var(--brand-green)_35%,transparent),transparent_70%),radial-gradient(40%_60%_at_90%_90%,color-mix(in_oklab,var(--brand-yellow)_25%,transparent),transparent_70%)]" />
          <div className="relative mx-auto max-w-2xl space-y-5">
            <h2 className="text-2xl font-black sm:text-3xl">{t.ctaTitle}</h2>
            {t.ctaText ? <p className="leading-9 text-brand-cream/80">{t.ctaText}</p> : null}
            <Button asChild size="lg">
              <a href="/atom-world"><Box /> ورود به دنیای سه‌بعدی</a>
            </Button>
          </div>
        </div>
      </Container>
    </>
  );
}

function ParkSkeleton() {
  return (
    <Container className="grid grid-cols-1 gap-10 py-14 lg:grid-cols-2">
      <div className="space-y-4"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-6 w-full" /><Skeleton className="h-24 w-full" /></div>
      <Skeleton className="aspect-[5/4] w-full rounded-3xl" />
    </Container>
  );
}
