import type { Metadata } from "next";
import { pageMetadata, seoPath } from "@/lib/seo";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, CalendarDays, Gift, Ticket, Users } from "lucide-react";
import { TournamentBoard } from "@/components/tournaments/board";
import { LiveRefresh, RegistrationBox } from "@/components/tournaments/public-widgets";
import { PredictionsPanel } from "@/components/tournaments/predictions-panel";
import { SectionGate } from "@/components/layout/section-gate";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { checkInOpen, FORMAT_LABELS, groupName, STATUS_BADGE, STATUS_LABELS } from "@/features/tournaments/constants";
import { getPublicTournament, type TournamentView } from "@/features/tournaments/queries";
import { getCurrentUser } from "@/lib/auth/dal";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { db } from "@/lib/db";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata({ params }: PageProps<"/tournaments/[slug]">): Promise<Metadata> {
  const t = await getPublicTournament(decodeURIComponent((await params).slug));
  if (!t) return { title: "پیدا نشد", robots: { index: false } };
  const title = t.name.includes("تورنومنت") ? t.name : `تورنومنت ${t.name}`;
  return pageMetadata({ title, description: `تورنومنت ${t.game} — ${FORMAT_LABELS[t.format]} — برگزارکننده: ${t.organizerName}. جدول مسابقات، نتایج و ثبت‌نام.`, path: seoPath("tournaments", t.slug) });
}

function TournamentPageContent({ params, searchParams }: PageProps<"/tournaments/[slug]">) {
  return (
    <Container className="py-8 sm:py-12">
      <Link href="/tournaments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="size-4" /> تورنومنت‌ها</Link>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-64 rounded-xl" /></div>}>
        <TournamentContent params={params} searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

const PAYMENT_NOTICE: Record<string, { variant: "success" | "destructive" | "warning"; text: string }> = {
  paid: { variant: "success", text: "پرداخت انجام شد و ثبت‌نام شما کامل شد." },
  failed: { variant: "destructive", text: "پرداخت انجام نشد و ثبت‌نام کامل نشد. اگر مبلغی کم شده، تا ۷۲ ساعت برمی‌گردد؛ می‌توانید دوباره ثبت‌نام کنید." },
  late_paid_needs_refund: { variant: "warning", text: "پرداخت انجام شد، اما ثبت‌نام دیگر ممکن نبود (مثلاً ظرفیت تکمیل شده بود). مبلغ توسط اتم گیم کلاب بازگردانده می‌شود." },
  error: { variant: "warning", text: "نتیجهٔ پرداخت هنوز مشخص نیست؛ چند دقیقه بعد همین صفحه را ببینید یا با پشتیبانی تماس بگیرید." },
};

async function TournamentContent({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const slug = decodeURIComponent((await params).slug);
  const notice = PAYMENT_NOTICE[String((await searchParams).payment ?? "")];
  const hasFee = (t: TournamentView) => BigInt(t.entryFee) > BigInt(0);
  await connection();
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  // Players report their own results and can't predict them: find the visitor's participant (live, not cached).
  const viewer = (t.allowPlayerReports || t.allowPredictions) && t.status === "IN_PROGRESS" ? await getCurrentUser() : null;
  const viewerParticipantId = viewer ? (t.participants.find((p) => p.userId === viewer.id)?.id ?? null) : null;
  return (
    <div className="space-y-6">
      {notice ? <Alert variant={notice.variant}>{notice.text}</Alert> : null}
      <LiveRefresh active={t.status === "IN_PROGRESS" || t.status === "REGISTRATION"} />
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black">{t.name}</h1>
          <Badge variant={STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
        </div>
        <p className="text-muted-foreground">{t.game}{t.platform ? ` · ${t.platform}` : ""} · {FORMAT_LABELS[t.format]} · برگزارکننده: {t.organizerName}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span className="flex items-center gap-1.5"><Users className="size-4 text-muted-foreground" /> {formatNumber(t.participants.length)}{t.maxParticipants ? ` / ${formatNumber(t.maxParticipants)}` : ""} {t.teamSize ? `تیم (${formatNumber(t.teamSize)} نفره)` : "شرکت‌کننده"}{t.waitlistCount ? ` · ${formatNumber(t.waitlistCount)} نفر در لیست انتظار` : ""}</span>
          {t.startsAt ? <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-muted-foreground" /> {formatDateTime(new Date(t.startsAt))}</span> : null}
          {t.prize ? <span className="flex items-center gap-1.5"><Gift className="size-4 text-muted-foreground" /> {t.prize}</span> : null}
          {hasFee(t) ? <span className="flex items-center gap-1.5 font-semibold"><Ticket className="size-4 text-muted-foreground" /> هزینهٔ ثبت‌نام: {formatToman(BigInt(t.entryFee))} (پرداخت آنلاین)</span> : null}
          {t.entryFeeNote ? <span className="flex items-center gap-1.5"><Ticket className="size-4 text-muted-foreground" /> {t.entryFeeNote}</span> : null}
        </div>
      </header>

      {t.status === "REGISTRATION" && t.allowSelfRegistration ? (
        <Card className="border-brand-green/40 print:hidden">
          <CardHeader><CardTitle className="text-base">ثبت‌نام</CardTitle></CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-10 w-64" />}>
              <Registration t={t} />
            </Suspense>
          </CardContent>
        </Card>
      ) : null}

      {t.status === "CANCELLED" ? <p className="rounded-xl bg-destructive-soft p-4 text-sm font-medium text-destructive">این تورنومنت لغو شده است.</p> : null}

      <TournamentBoard t={t} tools viewerParticipantId={viewerParticipantId} />

      {t.allowPredictions && (t.status === "IN_PROGRESS" || t.status === "COMPLETED") ? <PredictionsPanel t={t} viewerParticipantId={viewerParticipantId} /> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
  const feeLabel = BigInt(t.entryFee) > BigInt(0) ? formatToman(BigInt(t.entryFee)) : undefined;
  if (!user) return <RegistrationBox tournamentId={t.id} slug={t.slug} state="guest" defaultName="" />;
  // Read live (the tournament view is cached): a payment may have just added this player.
  const [mine, refund, waiting] = await Promise.all([
    db.tournamentParticipant.findFirst({ where: { tournamentId: t.id, userId: user.id }, select: { name: true, checkedInAt: true, paidEntry: { select: { status: true } } } }),
    db.tournamentEntry.findFirst({ where: { tournamentId: t.id, userId: user.id, status: "REFUND_NEEDED" }, select: { id: true } }),
    db.tournamentWaitlist.findFirst({ where: { tournamentId: t.id, userId: user.id }, select: { createdAt: true } }),
  ]);
  const checkIn =
    t.checkInMinutes !== null && t.startsAt
      ? { open: checkInOpen(new Date(t.startsAt), t.checkInMinutes), done: !!mine?.checkedInAt, opensAt: new Date(new Date(t.startsAt).getTime() - t.checkInMinutes * 60_000).toISOString() }
      : undefined;
  if (mine) return <RegistrationBox tournamentId={t.id} slug={t.slug} state="registered" defaultName="" entryName={mine.name} paid={mine.paidEntry?.status === "PAID"} checkIn={checkIn} />;
  if (waiting) {
    const position = (await db.tournamentWaitlist.count({ where: { tournamentId: t.id, createdAt: { lt: waiting.createdAt } } })) + 1;
    return <RegistrationBox tournamentId={t.id} slug={t.slug} state="waitlisted" defaultName="" waitlistPosition={position} />;
  }
  const full = t.maxParticipants !== null && t.participants.length >= t.maxParticipants;
  const waitlist = full && t.waitlistEnabled && !feeLabel;
  return (
    <div className="space-y-3">
      {refund ? <Alert variant="warning">یکی از پرداخت‌های شما برای این تورنومنت به ثبت‌نام نرسید و مبلغ آن بازگردانده می‌شود.</Alert> : null}
      <RegistrationBox tournamentId={t.id} slug={t.slug} state={waitlist ? "waitlist" : full ? "full" : "open"} defaultName={user.name} feeLabel={feeLabel} teamSize={t.teamSize} questions={t.signupQuestions} />
    </div>
  );
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
                <span className="min-w-0">
                  <span className={p.disqualifiedAt ? "block truncate font-medium text-muted-foreground line-through" : "block truncate font-medium"}>{p.name}</span>
                  {p.members.length ? <span className="block truncate text-xs text-muted-foreground">{p.members.join("، ")}</span> : null}
                </span>
                {p.disqualifiedAt ? <span className="text-xs text-destructive">حذف‌شده</span> : null}
                {p.groupIndex !== null && t.format === "GROUPS_KNOCKOUT" ? <span className="ms-auto text-xs text-muted-foreground">{groupName(p.groupIndex)}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

/** Hidden from visitors when the admin turns the section off (Admin → تنظیمات سایت → نمایش بخش‌ها). */
export default function TournamentPage(props: PageProps<"/tournaments/[slug]">) {
  return (
    <Suspense fallback={null}>
      <SectionGate section="tournaments">
        <TournamentPageContent {...props} />
      </SectionGate>
    </Suspense>
  );
}
