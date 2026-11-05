import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, LoadingRows } from "@/components/ui/states";
import { FORMAT_LABELS, STATUS_BADGE, STATUS_LABELS } from "@/features/tournaments/constants";
import { getCoOrganizedTournaments } from "@/features/tournaments/queries";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "تورنومنت‌های من", robots: { index: false } };

export default function MyTournamentsPage() {
  return (
    <>
      <h1 className="text-2xl font-black">تورنومنت‌های من</h1>
      <Suspense fallback={<LoadingRows rows={4} />}>
        <Lists />
      </Suspense>
    </>
  );
}

async function Lists() {
  const user = await requireUser("/account/tournaments");
  const [joined, waiting, organizing] = await Promise.all([
    db.tournamentParticipant.findMany({
      where: { userId: user.id, tournament: { status: { not: "DRAFT" } } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, finalRank: true, tournament: { select: { slug: true, name: true, status: true, format: true, startsAt: true } } },
    }),
    db.tournamentWaitlist.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, tournament: { select: { slug: true, name: true } } } }),
    getCoOrganizedTournaments(user.id),
  ]);
  if (!joined.length && !waiting.length && !organizing.length) {
    return <EmptyState icon={Trophy} title="هنوز در تورنومنتی شرکت نکرده‌اید" action={<Button asChild><Link href="/tournaments">دیدن تورنومنت‌ها</Link></Button>} />;
  }
  return (
    <div className="space-y-6">
      {organizing.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">همکار برگزاری</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {organizing.map((t) => (
                <li key={t.id}>
                  <Link href={`/account/tournaments/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-secondary/50">
                    <span><span className="font-bold">{t.name}</span> <span className="text-xs text-muted-foreground">{FORMAT_LABELS[t.format]}</span></span>
                    <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      {joined.length || waiting.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">ثبت‌نام‌های من</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y rounded-xl border">
              {waiting.map((w) => (
                <li key={w.id}>
                  <Link href={`/tournaments/${w.tournament.slug}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-secondary/50">
                    <span className="font-bold">{w.tournament.name}</span>
                    <Badge variant="warning">لیست انتظار</Badge>
                  </Link>
                </li>
              ))}
              {joined.map((p) => (
                <li key={p.id}>
                  <Link href={`/tournaments/${p.tournament.slug}`} className="flex flex-wrap items-center justify-between gap-2 p-3 hover:bg-secondary/50">
                    <span className="space-y-0.5">
                      <span className="block font-bold">{p.tournament.name}</span>
                      <span className="block text-xs text-muted-foreground">با نام «{p.name}»{p.tournament.startsAt ? ` · ${formatDateTime(p.tournament.startsAt)}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {p.finalRank ? <span className="text-sm font-bold">رتبهٔ {p.finalRank.toLocaleString("fa-IR")}</span> : null}
                      <Badge variant={STATUS_BADGE[p.tournament.status]}>{STATUS_LABELS[p.tournament.status]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
