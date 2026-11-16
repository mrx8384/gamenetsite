import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarCheck, ScrollText } from "lucide-react";
import { BookingPicker } from "@/components/booking/booking-picker";
import { Container } from "@/components/layout/container";
import { SectionGate } from "@/components/layout/section-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getBookingCalendar } from "@/features/booking/queries";
import { getPaymentProvider } from "@/features/payments";
import { getSiteSettings } from "@/features/settings/site";
import { getCurrentUser } from "@/lib/auth/dal";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getSiteSettings("booking");
  return pageMetadata({ title: t.title, description: t.subtitle, path: "/booking" });
}

export default function BookingPage() {
  return (
    <Suspense fallback={null}>
      <SectionGate section="booking">
        <Container className="py-8 sm:py-12">
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>}>
            <BookingContent />
          </Suspense>
        </Container>
      </SectionGate>
    </Suspense>
  );
}

async function BookingContent() {
  await connection();
  const [t, { config, calendar, hasShifts }, user, provider] = await Promise.all([getSiteSettings("booking"), getBookingCalendar(), getCurrentUser(), getPaymentProvider()]);
  const rules = t.rules.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl"><CalendarCheck className="size-7 text-brand-green-deep" aria-hidden /> {t.title}</h1>
        {t.subtitle ? <p className="text-muted-foreground">{t.subtitle}</p> : null}
      </header>
      {!hasShifts ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t.emptyText}</p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            {t.intro ? <p className="text-sm leading-7 text-muted-foreground whitespace-pre-line">{t.intro}</p> : null}
            {user ? (
              <BookingPicker
                calendar={calendar}
                askGuests={config.askGuests}
                maxGuests={config.maxGuests}
                onlinePayment={provider !== null}
                defaults={{ name: user.name, phone: user.phone ?? "" }}
              />
            ) : (
              <>
                <BookingPicker calendar={calendar} askGuests={false} maxGuests={1} onlinePayment={provider !== null} defaults={null} />
                <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-4 text-sm">
                  <span>برای ثبت رزرو وارد حساب کاربری شوید.</span>
                  <Button asChild size="sm"><Link href="/login?next=/booking">ورود / ثبت‌نام</Link></Button>
                </div>
              </>
            )}
          </div>
          {rules.length ? (
            <aside className="space-y-2 self-start rounded-xl border bg-surface p-4 lg:sticky lg:top-24">
              <h2 className="flex items-center gap-2 font-bold"><ScrollText className="size-4" aria-hidden /> قوانین رزرو</h2>
              <ul className="list-disc space-y-1 ps-5 text-sm leading-7 text-muted-foreground">
                {rules.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}
