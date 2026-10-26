import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { CalendarDays, Gamepad, Trophy, Users } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSiteSettings } from "@/features/settings/site";
import { FORMAT_LABELS, STATUS_BADGE, STATUS_LABELS } from "@/features/tournaments/constants";
import { getPublicTournaments, type TournamentCard } from "@/features/tournaments/queries";
import { formatDateTime, formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "تورنومنت‌ها", description: "تورنومنت‌های FC و بازی‌های دیگر در اتم گیم کلاب و گیم‌نت‌های همکار" };

export default async function TournamentsPage() {
  const t = await getSiteSettings("tournaments");
  return (
    <Container className="space-y-8 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Badge variant="strong">{t.badge}</Badge>
          <h1 className="flex items-center gap-3 text-3xl font-black">
            <span className="h-8 w-1.5 rounded-full bg-brand-green" aria-hidden />
            تورنومنت‌ها
          </h1>
        </div>
        <Button asChild variant="outline"><Link href="/tournaments/gamepad-tester"><Gamepad /> تست دسته (ویژهٔ همکاران)</Link></Button>
      </div>
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div>}>
        <TournamentSections empty={t.comingSoon} />
      </Suspense>
    </Container>
  );
}

async function TournamentSections({ empty }: { empty: string }) {
  await connection();
  const all = await getPublicTournaments();
  if (all.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-brand-yellow text-brand-black"><Trophy className="size-9" aria-hidden /></span>
        <p className="text-lg font-semibold">{empty}</p>
      </div>
    );
  }
  const sections: [string, TournamentCard[]][] = [
    ["ثبت‌نام باز", all.filter((x) => x.status === "REGISTRATION")],
    ["در حال برگزاری", all.filter((x) => x.status === "IN_PROGRESS")],
    ["پایان‌یافته", all.filter((x) => x.status === "COMPLETED")],
  ];
  return (
    <div className="space-y-10">
      {sections.filter(([, list]) => list.length > 0).map(([title, list]) => (
        <section key={title} className="space-y-4" aria-labelledby={`sec-${title}`}>
          <h2 id={`sec-${title}`} className="text-xl font-bold">{title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((x) => (
              <Link key={x.id} href={`/tournaments/${x.slug}`} className="group flex flex-col gap-3 rounded-xl border bg-surface p-5 shadow-card transition-shadow hover:shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold group-hover:text-link">{x.name}</h3>
                  <Badge variant={STATUS_BADGE[x.status]}>{STATUS_LABELS[x.status]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{x.game}{x.platform ? ` · ${x.platform}` : ""} · {FORMAT_LABELS[x.format]}</p>
                <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="size-3.5" /> {formatNumber(x.participantCount)}{x.maxParticipants ? ` / ${formatNumber(x.maxParticipants)}` : ""}</span>
                  {x.startsAt ? <span className="flex items-center gap-1"><CalendarDays className="size-3.5" /> {formatDateTime(new Date(x.startsAt))}</span> : null}
                </div>
                <p className="text-xs text-muted-foreground">برگزارکننده: {x.organizerName}{x.prize ? ` — جایزه: ${x.prize}` : ""}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
