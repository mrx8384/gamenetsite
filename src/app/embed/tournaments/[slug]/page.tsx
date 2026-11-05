import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { TournamentBoard } from "@/components/tournaments/board";
import { LiveRefresh } from "@/components/tournaments/public-widgets";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getSectionVisibility } from "@/features/settings/sections";
import { FORMAT_LABELS, STATUS_BADGE, STATUS_LABELS } from "@/features/tournaments/constants";
import { getPublicTournament } from "@/features/tournaments/queries";
import { env } from "@/lib/env";

/**
 * Bracket only, for other websites (<iframe>; framing allowed for /embed/* in next.config.ts).
 * No site header/footer; links open the full page on this site in a new tab.
 */
export const metadata: Metadata = { title: "جدول تورنومنت", robots: { index: false, follow: false } };

export default function EmbedTournamentPage({ params }: PageProps<"/embed/tournaments/[slug]">) {
  return (
    <main className="min-h-dvh bg-background p-3 sm:p-4">
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/embed/tournaments/[slug]">["params"] }) {
  const slug = decodeURIComponent((await params).slug);
  await connection();
  if (!(await getSectionVisibility()).tournaments) notFound();
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  const url = `${env.APP_URL.replace(/\/$/, "")}/tournaments/${encodeURIComponent(t.slug)}`;
  return (
    <div className="space-y-4">
      <LiveRefresh active={t.status === "IN_PROGRESS"} />
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-black">{t.name}</h1>
        <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
        <span className="text-sm text-muted-foreground">{t.game} · {FORMAT_LABELS[t.format]}</span>
        <a href={url} target="_blank" rel="noopener" className="ms-auto text-sm font-bold text-link hover:underline">مشاهده در اتم گیم کلاب ↗</a>
      </header>
      <TournamentBoard t={t} />
    </div>
  );
}
