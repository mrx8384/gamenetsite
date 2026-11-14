import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, Megaphone } from "lucide-react";
import { SectionGate } from "@/components/layout/section-gate";
import { Container } from "@/components/layout/container";
import { TournamentBoard } from "@/components/tournaments/board";
import { LiveRefresh } from "@/components/tournaments/public-widgets";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMAT_LABELS, STATUS_BADGE, STATUS_LABELS } from "@/features/tournaments/constants";
import { getPublicTournament } from "@/features/tournaments/queries";

/**
 * Live page of a running tournament, for players and spectators: group tables (qualifiers highlighted),
 * bracket, matches being played and results, refreshed every 15 seconds, plus the organizer's notice.
 */
export async function generateMetadata({ params }: PageProps<"/tournaments/[slug]/live">): Promise<Metadata> {
  const t = await getPublicTournament(decodeURIComponent((await params).slug));
  return { title: t ? `لایو ${t.name}` : "پیدا نشد", robots: { index: false } };
}

export default function TournamentLivePage({ params }: PageProps<"/tournaments/[slug]/live">) {
  return (
    <Suspense fallback={null}>
      <SectionGate section="tournaments">
        <Container className="py-6 sm:py-10">
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 rounded-xl" /></div>}>
            <Live params={params} />
          </Suspense>
        </Container>
      </SectionGate>
    </Suspense>
  );
}

async function Live({ params }: { params: PageProps<"/tournaments/[slug]/live">["params"] }) {
  const slug = decodeURIComponent((await params).slug);
  await connection();
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  const running = t.status === "IN_PROGRESS";
  return (
    <div className="space-y-5">
      <LiveRefresh active={running || t.status === "REGISTRATION"} seconds={15} />
      <Link href={`/tournaments/${encodeURIComponent(t.slug)}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> صفحهٔ تورنومنت</Link>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {running ? <span className="flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-black text-destructive-foreground"><span className="size-2 animate-pulse rounded-full bg-white" aria-hidden /> LIVE</span> : null}
          <h1 className="text-2xl font-black sm:text-3xl">{t.name}</h1>
          <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t.game} · {FORMAT_LABELS[t.format]} · برگزارکننده: {t.organizerName}{running ? " · به‌روزرسانی خودکار هر ۱۵ ثانیه" : ""}</p>
      </header>
      {t.liveNotice ? (
        <p className="flex items-start gap-2 rounded-xl border border-brand-yellow/60 bg-warning-soft p-4 text-sm font-semibold leading-7 whitespace-pre-line" role="status">
          <Megaphone className="mt-1 size-4 shrink-0" aria-hidden /> {t.liveNotice}
        </p>
      ) : null}
      {t.status === "REGISTRATION" || t.status === "DRAFT" ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">تورنومنت هنوز شروع نشده است؛ با شروع، جدول و نتایج همین‌جا نمایش داده می‌شود.</p>
      ) : (
        <TournamentBoard t={t} tools />
      )}
    </div>
  );
}
