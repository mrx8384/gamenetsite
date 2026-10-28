import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { PartnerServices } from "@/components/home/partner-services";
import { Container } from "@/components/layout/container";
import { PartnerStatusBadge } from "@/components/partners/partner-status";
import { PlanCards } from "@/components/partners/plan-cards";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getVisiblePlans } from "@/features/partners/queries";
import { getSiteSettings } from "@/features/settings/site";
import { getCurrentUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";

export const metadata: Metadata = pageMetadata({ title: "همکاری با اتم", description: "همکاری گیم‌نت‌ها، فروشگاه‌ها و تیم‌های ای‌اسپورت با اتم گیم کلاب: پنل اختصاصی همکار، تست دسته و برگزاری تورنومنت.", path: "/partners" });

export default async function PartnersPage() {
  const [t, home] = await Promise.all([getSiteSettings("partners"), getSiteSettings("home")]);
  return (
    <Container className="space-y-12 py-8 sm:py-12">
      <section className="space-y-4">
        <h1 className="flex items-center gap-3 text-3xl font-black">
          <span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />
          {t.pageTitle}
        </h1>
        <p className="max-w-3xl leading-8 text-muted-foreground">{t.pageIntro}</p>
        <Suspense fallback={<Skeleton className="h-11 w-48" />}>
          <PartnerCta />
        </Suspense>
      </section>

      <section>
        <PartnerServices
          title={home.partnersTitle}
          subtitle={home.partnersSubtitle}
          points={[
            { title: home.partner1Title, body: home.partner1Body },
            { title: home.partner2Title, body: home.partner2Body },
            { title: home.partner3Title, body: home.partner3Body },
          ]}
          hideCta
        />
      </section>

      <section className="space-y-4" aria-labelledby="plans-title">
        <h2 id="plans-title" className="text-2xl font-bold">{t.plansTitle}</h2>
        <Suspense fallback={<Skeleton className="h-48 rounded-xl" />}>
          <Plans note={t.plansNote} />
        </Suspense>
      </section>
    </Container>
  );
}

async function Plans({ note }: { note: string }) {
  await connection();
  return <PlanCards plans={await getVisiblePlans()} note={note} />;
}

async function PartnerCta() {
  const user = await getCurrentUser();
  const profile = user ? await db.partnerProfile.findUnique({ where: { userId: user.id }, select: { status: true } }) : null;
  if (profile) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="strong" size="lg"><Link href="/partner">ورود به پنل همکار <ArrowLeft /></Link></Button>
        <span className="text-sm text-muted-foreground">وضعیت درخواست:</span>
        <PartnerStatusBadge status={profile.status} />
      </div>
    );
  }
  if (user?.role === "ADMIN") {
    return <Button asChild variant="outline" size="lg"><Link href="/admin/partners">بررسی درخواست‌های همکاری</Link></Button>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild variant="strong" size="lg"><Link href="/partner">ثبت درخواست همکاری <ArrowLeft /></Link></Button>
      {!user ? <span className="text-sm text-muted-foreground">برای ثبت درخواست، وارد حساب کاربری شوید یا ثبت‌نام کنید.</span> : null}
    </div>
  );
}
