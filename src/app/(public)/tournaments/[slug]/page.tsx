import type { Metadata } from "next";
import { pageMetadata, seoPath } from "@/lib/seo";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, CalendarDays, Gift, Ticket, Users } from "lucide-react";
import { TournamentBoard } from "@/components/tournaments/board";
import { LiveRefresh, RegistrationBox } from "@/components/tournaments/public-widgets";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FORMAT_LABELS, groupName, STATUS_BADGE, STATUS_LABELS } from "@/features/tournaments/constants";
import { getPublicTournament, type TournamentView } from "@/features/tournaments/queries";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateTime, formatNumber } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/tournaments/[slug]">): Promise<Metadata> {
  const t = await getPublicTournament(decodeURIComponent((await params).slug));
  if (!t) return { title: "پیدا نشد", robots: { index: false } };
  const title = t.name.includes("تورنومنت") ? t.name : `تورنومنت ${t.name}`;
  return pageMetadata({ title, description: `تورنومنت ${t.game} — ${FORMAT_LABELS[t.format]} — برگزارکننده: ${t.organizerName}. جدول مسابقات، نتایج و ثبت‌نام.`, path: seoPath("tournaments", t.slug) });
}

export default function TournamentPage({ params }: PageProps<"/tournaments/[slug]">) {
  return (
    <Container className="py-8 sm:py-12">
      <Link href="/tournaments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> تورنومنت‌ها</Link>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 rounded-xl" /></div>}>
        <TournamentContent params={params} />
      </Suspense>
    </Container>
  );
}

async function TournamentContent({ params }: { params: Promise<{ slug: string }> }) {
  const slug = decodeURIComponent((await params).slug);
  await connection();
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  return (
    <div className="space-y-6">
      <LiveRefresh active={t.status === "IN_PROGRESS" || t.status === "REGISTRATION"} />
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black">{t.name}</h1>
          <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
        </div>
        <p className="text-muted-foreground">{t.game}{t.platform ? ` · ${t.platform}` : ""} · {FORMAT_LABELS[t.format]} · برگزارکننده: {t.organizerName}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5"><Users className="size-4 text-muted-foreground" /> {formatNumber(t.participants.length)}{t.maxParticipants ? ` / ${formatNumber(t.maxParticipants)}` : ""} شرکت‌کننده</span>
          {t.startsAt ? <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-muted-foreground" /> {formatDateTime(new Date(t.startsAt))}</span> : null}
          {t.prize ? <span className="flex items-center gap-1.5"><Gift className="size-4 text-muted-foreground" /> {t.prize}</span> : null}
          {t.entryFeeNote ? <span className="flex items-center gap-1.5"><Ticket className="size-4 text-muted-foreground" /> {t.entryFeeNote}</span> : null}
        </div>
      </header>

      {t.status === "REGISTRATION" && t.allowSelfRegistration ? (
        <Card className="border-brand-green/40">
          <CardHeader><CardTitle className="text-base">ثبت‌نام</CardTitle></CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-10 w-64" />}>
              <Registration t={t} />
            </Suspense>
          </CardContent>
        </Card>
      ) : null}

      {t.status === "CANCELLED" ? <p className="rounded-xl bg-destructive-soft p-4 text-sm font-medium text-destructive">این تورنومنت لغو شده است.</p> : null}

      <TournamentBoard t={t} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Participants t={t} />
        {t.description || t.rules ? (
          <Card>
            <CardHeader><CardTitle className="text-base">توضیحات و قوانین</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm leading-7">
              {t.description ? <p className="whitespace-pre-line">{t.description}</p> : null}
              {t.rules ? <div><p className="mb-1 font-bold">قوانین</p><p className="whitespace-pre-line text-muted-foreground">{t.rules}</p></div> : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

async function Registration({ t }: { t: TournamentView }) {
  const user = await getCurrentUser();
  if (!user) return <RegistrationBox tournamentId={t.id} slug={t.slug} state="guest" defaultName="" />;
  const mine = t.participants.find((p) => p.userId === user.id);
  if (mine) return <RegistrationBox tournamentId={t.id} slug={t.slug} state="registered" defaultName="" entryName={mine.name} />;
  const full = t.maxParticipants !== null && t.participants.length >= t.maxParticipants;
  return <RegistrationBox tournamentId={t.id} slug={t.slug} state={full ? "full" : "open"} defaultName={user.name} />;
}

function Participants({ t }: { t: TournamentView }) {
  const list = t.status === "COMPLETED" ? [...t.participants].sort((a, b) => (a.finalRank ?? 999) - (b.finalRank ?? 999)) : t.participants;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">شرکت‌کنندگان</CardTitle></CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">هنوز کسی ثبت‌نام نکرده است.</p>
        ) : (
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 odd:bg-secondary/50">
                <span className="w-8 text-muted-foreground">{t.status === "COMPLETED" && p.finalRank ? `#${formatNumber(p.finalRank)}` : formatNumber(p.seed)}</span>
                <span className="truncate font-medium">{p.name}</span>
                {p.groupIndex !== null && t.format === "GROUPS_KNOCKOUT" ? <span className="ms-auto text-xs text-muted-foreground">{groupName(p.groupIndex)}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
