"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Crown, Maximize2, Medal, MonitorPlay, Plus, Printer, RotateCcw, Shuffle, Swords } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addLeaderboardRound, clearMatch, finishLeaderboard, nextSwissRound, reportMatch, setLeaderboardPoints, setMatchDetails, setMatchUnderway, startKnockout } from "@/features/tournaments/actions";
import { bracketLayout } from "@/features/tournaments/bracket-layout";
import { isoToTehranInput, tehranInputToIso } from "@/features/tournaments/time";
import { groupName, isEliminationStage, STAGE_LABELS } from "@/features/tournaments/constants";
import { claimMatchResult, confirmMatchClaim, rejectMatchClaim } from "@/features/tournaments/community-actions";
import { eliminationRoundName, leaderboardTable, type ResultRow, standings, swissRoundCount, swissStandings } from "@/features/tournaments/engine";
import type { TournamentView } from "@/features/tournaments/queries";
import { cn } from "@/lib/utils";

type Match = TournamentView["matches"][number];
const fa = (n: number) => n.toLocaleString("fa-IR");

interface BoardProps {
  t: TournamentView;
  manage?: boolean;
  /** Public page: «نمایش تلویزیون» (full screen) and print buttons. */
  tools?: boolean;
  /** Public page: the visitor's own participant id (player result reports). */
  viewerParticipantId?: string | null;
}

const timeFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", weekday: "short" });

/** Bracket / tables / matches for every format. `manage` adds result entry for the organizer. */
export function TournamentBoard({ t, manage = false, tools = false, viewerParticipantId = null }: BoardProps) {
  const box = React.useRef<HTMLDivElement>(null);
  const [tv, setTv] = React.useState(false);
  React.useEffect(() => {
    const on = () => setTv(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const names = React.useMemo(() => new Map(t.participants.map((p) => [p.id, p.name])), [t.participants]);
  const [editing, setEditing] = React.useState<Match | null>(null);
  const [reporting, setReporting] = React.useState<Match | null>(null);
  const canEdit = manage && (t.status === "IN_PROGRESS" || t.status === "COMPLETED");
  const playerReports = !manage && t.allowPlayerReports && t.status === "IN_PROGRESS" && !!viewerParticipantId;
  const onPick = canEdit ? (m: Match) => setEditing(m) : playerReports ? (m: Match) => setReporting(m) : undefined;
  const pickable = playerReports ? (m: Match) => m.status === "PENDING" && (m.player1Id === viewerParticipantId || m.player2Id === viewerParticipantId) : undefined;
  const ctx = { names, onPick, pickable, pickLabel: playerReports ? "گزارش نتیجه" : "ثبت نتیجه" };

  const started = t.status === "IN_PROGRESS" || t.status === "COMPLETED";
  if (t.format === "LEADERBOARD" ? !started : t.matches.length === 0) {
    return <p className="rounded-xl border border-dashed bg-surface/60 p-8 text-center text-sm text-muted-foreground">جدول بازی‌ها پس از شروع تورنومنت ساخته می‌شود.</p>;
  }

  const live = t.matches.filter((m) => m.underwayAt && m.status === "PENDING");
  return (
    <div ref={box} className={cn("space-y-6", tv && "overflow-auto bg-background p-6")}>
      {tools ? (
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          {tv ? <p className="me-auto text-2xl font-black">{t.name}</p> : null}
          <Button variant="outline" size="sm" onClick={() => (tv ? document.exitFullscreen() : box.current?.requestFullscreen())}>
            {tv ? <Maximize2 /> : <MonitorPlay />} {tv ? "خروج از تمام‌صفحه" : "نمایش تلویزیون (تمام‌صفحه)"}
          </Button>
          {!tv ? <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> چاپ جدول</Button> : null}
        </div>
      ) : null}
      {live.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-green/40 bg-success-soft/50 p-3 text-sm">
          <span className="flex items-center gap-1.5 font-bold text-success"><span className="size-2 animate-pulse rounded-full bg-brand-green" aria-hidden /> در حال بازی:</span>
          {live.map((m) => (
            <span key={m.id} className="rounded-full bg-surface px-3 py-1 shadow-sm">
              {names.get(m.player1Id ?? "")} <span className="text-muted-foreground">و</span> {names.get(m.player2Id ?? "")}
              {m.station ? <span className="text-muted-foreground"> — {m.station}</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      <Podium t={t} />
      {t.format === "LEADERBOARD" ? <LeaderboardSection t={t} manage={manage} /> : null}
      {t.format === "SWISS" ? <SwissSection t={t} manage={manage} {...ctx} /> : null}
      {t.format === "SINGLE_ELIMINATION" ? <EliminationSection title="جدول حذفی" matches={t.matches.filter((m) => m.stage === "WINNERS")} third={t.matches.find((m) => m.stage === "THIRD_PLACE")} {...ctx} /> : null}

      {t.format === "DOUBLE_ELIMINATION" ? (
        <>
          <EliminationSection title={STAGE_LABELS.WINNERS} matches={t.matches.filter((m) => m.stage === "WINNERS")} roundLabel={(r) => `دور ${fa(r)}`} {...ctx} />
          <EliminationSection title={STAGE_LABELS.LOSERS} matches={t.matches.filter((m) => m.stage === "LOSERS")} roundLabel={(r) => `دور ${fa(r)}`} {...ctx} />
          {t.matches.some((m) => m.stage === "GRAND_FINAL") ? (
            <Card>
              <CardHeader><CardTitle className="text-base">فینال بزرگ</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-4">
                {t.matches.filter((m) => m.stage === "GRAND_FINAL" || (m.stage === "GRAND_FINAL_RESET" && m.status !== "SKIPPED")).map((m) => (
                  <div key={m.id} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{STAGE_LABELS[m.stage]}</p>
                    <MatchCard m={m} {...ctx} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {t.format === "ROUND_ROBIN" ? (
        <>
          <StandingsCard title="جدول امتیازات" ids={t.participants.map((p) => p.id)} matches={t.matches} t={t} names={names} />
          <RoundsCard matches={t.matches} {...ctx} />
        </>
      ) : null}

      {t.format === "GROUPS_KNOCKOUT" ? (
        <>
          {Array.from({ length: t.groupCount ?? 0 }, (_, gi) => {
            const ids = t.participants.filter((p) => p.groupIndex === gi).map((p) => p.id);
            if (ids.length === 0) return null;
            const gm = t.matches.filter((m) => m.stage === "GROUP" && m.groupIndex === gi);
            return (
              <div key={gi} className="grid gap-4 lg:grid-cols-2">
                <StandingsCard title={groupName(gi)} ids={ids} matches={gm} t={t} names={names} qualify={t.advancePerGroup ?? 0} />
                <RoundsCard matches={gm} {...ctx} compact />
              </div>
            );
          })}
          {t.knockoutStarted ? (
            <EliminationSection title="مرحلهٔ حذفی" matches={t.matches.filter((m) => m.stage === "WINNERS")} third={t.matches.find((m) => m.stage === "THIRD_PLACE")} {...ctx} />
          ) : manage && t.status === "IN_PROGRESS" ? (
            <StartKnockout t={t} />
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">مرحلهٔ حذفی پس از پایان بازی‌های گروهی شروع می‌شود.</p>
          )}
        </>
      ) : null}

      {editing ? <ReportDialog key={editing.id} m={editing} names={names} onClose={() => setEditing(null)} /> : null}
      {reporting ? <PlayerReportDialog key={reporting.id} m={reporting} names={names} mySlot={reporting.player1Id === viewerParticipantId ? 1 : 2} onClose={() => setReporting(null)} /> : null}
    </div>
  );
}

function Podium({ t }: { t: TournamentView }) {
  if (t.status !== "COMPLETED") return null;
  const top = [...t.participants].filter((p) => p.finalRank && p.finalRank <= 3).sort((a, b) => a.finalRank! - b.finalRank!);
  if (!top.length) return null;
  return (
    <Card className="border-brand-yellow/60 bg-warning-soft/40">
      <CardContent className="flex flex-wrap items-center justify-center gap-6">
        {top.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            {p.finalRank === 1 ? <Crown className="size-6 text-warning" /> : <Medal className={cn("size-5", p.finalRank === 2 ? "text-muted-foreground" : "text-warning/70")} />}
            <span className="text-sm text-muted-foreground">{p.finalRank === 1 ? "قهرمان" : p.finalRank === 2 ? "نایب‌قهرمان" : "سوم"}</span>
            <span className="font-black">{p.name}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface Ctx {
  names: Map<string, string>;
  onPick?: (m: Match) => void;
  /** Limits which matches onPick applies to (players: only their own). */
  pickable?: (m: Match) => boolean;
  pickLabel?: string;
}

const BOX = { w: 208, h: 84, gapX: 44, gapY: 14 };

function EliminationSection({ title, matches, third, roundLabel, names, onPick, pickable, pickLabel }: Ctx & { title: string; matches: Match[]; third?: Match; roundLabel?: (r: number) => string }) {
  if (matches.length === 0) return null;
  const layout = bracketLayout(matches, BOX);
  const total = layout.rounds.length;
  const byId = new Map(matches.map((m) => [m.id, m]));
  return (
    <Card className="print:break-inside-avoid print:shadow-none">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="relative mx-auto" style={{ width: layout.width, height: layout.height + 28 }}>
            {layout.rounds.map(({ round, x }) => (
              <p key={round} className="absolute top-0 text-center text-xs font-bold text-muted-foreground" style={{ left: x, width: BOX.w }}>
                {roundLabel ? roundLabel(round) : eliminationRoundName(round, total)}
              </p>
            ))}
            <svg className="pointer-events-none absolute start-0 top-7" width={layout.width} height={layout.height} aria-hidden>
              {layout.lines.map((l) => {
                const done = byId.get(l.from)?.status === "COMPLETED";
                return <path key={l.from} d={l.d} fill="none" className={done ? "stroke-brand-green" : "stroke-border"} strokeWidth={2} />;
              })}
            </svg>
            {[...layout.boxes.values()].map((b) => (
              <div key={b.id} className="absolute" style={{ left: b.x, top: b.y + 28, width: BOX.w, height: BOX.h }}>
                <MatchCard m={byId.get(b.id)!} names={names} onPick={onPick} pickable={pickable} pickLabel={pickLabel} fixed />
              </div>
            ))}
          </div>
        </div>
        {third ? (
          <div className="mt-4 space-y-1 border-t pt-4">
            <p className="text-xs font-bold text-muted-foreground">{STAGE_LABELS.THIRD_PLACE}</p>
            <MatchCard m={third} names={names} onPick={onPick} pickable={pickable} pickLabel={pickLabel} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function slotLabel(m: Match, slot: 1 | 2, names: Map<string, string>) {
  const id = slot === 1 ? m.player1Id : m.player2Id;
  const bye = slot === 1 ? m.player1Bye : m.player2Bye;
  if (bye) return { text: "استراحت", muted: true };
  if (!id) return { text: "در انتظار", muted: true };
  return { text: names.get(id) ?? "—", muted: false };
}

function MatchCard({ m, names, onPick, pickable, pickLabel = "ثبت نتیجه", fixed = false }: { m: Match; fixed?: boolean } & Ctx) {
  const isBye = m.player1Bye || m.player2Bye;
  const playable = !!onPick && (!pickable || pickable(m)) && !isBye && !!m.player1Id && !!m.player2Id && m.status !== "SKIPPED";
  const claim = m.status === "PENDING" && m.claimBySlot ? { label: "گزارش بازیکن:", ltr: `${m.claimScore1 ?? ""}-${m.claimScore2 ?? ""}`, after: "(در انتظار تأیید)" } : null;
  const underway = !!m.underwayAt && m.status === "PENDING";
  const sets = m.setScores ? m.setScores.split(",") : [];
  const row = (slot: 1 | 2) => {
    const l = slotLabel(m, slot, names);
    const won = m.status === "COMPLETED" && m.winnerSlot === slot && !isBye;
    const score = slot === 1 ? m.score1 : m.score2;
    const shown = m.forfeit ? (won ? "✓" : "—") : score === null ? "" : fa(score);
    return (
      <div className={cn("flex h-8 items-center justify-between gap-2 px-3", won && "bg-success-soft font-bold")}>
        <span className={cn("truncate text-sm", l.muted && "text-muted-foreground italic")}>{l.text}</span>
        <span className={cn("ltr min-w-6 text-center text-sm tabular-nums", won ? "text-success" : "text-muted-foreground")}>{shown}</span>
      </div>
    );
  };
  // Scores ("3-1", "3-1 2-3") are rendered in their own left-to-right element: inside Persian text
  // the bidi algorithm would otherwise show them reversed ("1-3").
  type Info = { label?: string; ltr?: string; after?: string };
  const info = [
    claim,
    m.forfeit ? { label: "برد فنی" } : null,
    sets.length ? { label: "دست‌ها:", ltr: sets.join("  ") } : null,
    m.station ? { label: m.station } : null,
    m.scheduledAt && m.status === "PENDING" ? { label: timeFmt.format(new Date(m.scheduledAt)) } : null,
    m.note ? { label: m.note } : null,
  ].filter(Boolean) as Info[];
  const infoText = (sep: string) => info.map((x) => [x.label, x.ltr, x.after].filter(Boolean).join(" ")).join(sep);
  const body = (
    <>
      <div className={cn("flex h-5 items-center gap-2 border-b px-3 text-[10px] text-muted-foreground", underway && "bg-success-soft")}>
        <span>#{fa(m.number)}</span>
        {underway ? <span className="flex items-center gap-1 font-bold text-success"><span className="size-1.5 animate-pulse rounded-full bg-brand-green" aria-hidden />در حال بازی</span> : null}
        <span className="min-w-0 flex-1 truncate">
          {info.map((x, i) => (
            <React.Fragment key={i}>
              {i > 0 ? " · " : null}
              {x.label}
              {x.ltr ? <> <span dir="ltr" className="inline-block">{x.ltr}</span></> : null}
              {x.after ? ` ${x.after}` : null}
            </React.Fragment>
          ))}
        </span>
        {playable && m.status === "PENDING" && !underway ? <span className="shrink-0 font-bold text-link">{claim && !pickable ? "تأیید" : pickLabel}</span> : null}
      </div>
      {row(1)}
      <div className="border-t" />
      {row(2)}
    </>
  );
  const cls = cn("overflow-hidden rounded-lg border bg-surface text-start shadow-sm", fixed ? "h-[84px] w-full" : "w-52", isBye && "opacity-60", underway && "border-brand-green ring-2 ring-brand-green/30", claim && "border-warning");
  const title = info.length ? infoText(" — ") : undefined;
  return playable ? (
    <button type="button" title={title} onClick={() => onPick!(m)} className={cn(cls, "cursor-pointer transition-shadow hover:border-brand-green hover:shadow-md")} aria-label={`بازی ${fa(m.number)}`}>
      {body}
    </button>
  ) : (
    <div className={cls} title={title}>{body}</div>
  );
}

/** Completed two-player matches as engine result rows (forfeits carry the chosen winner). */
function resultRows(matches: Match[]): ResultRow[] {
  return matches
    .filter((m) => m.status === "COMPLETED" && m.player1Id && m.player2Id && ((m.score1 !== null && m.score2 !== null) || (m.forfeit && m.winnerSlot)))
    .map((m) => ({ player1: m.player1Id!, player2: m.player2Id!, score1: m.score1 ?? 0, score2: m.score2 ?? 0, winner: m.forfeit && (m.winnerSlot === 1 || m.winnerSlot === 2) ? (m.winnerSlot as 1 | 2) : undefined }));
}

function StandingsCard({ title, ids, matches, t, names, qualify = 0 }: { title: string; ids: string[]; matches: Match[]; t: TournamentView; names: Map<string, string>; qualify?: number }) {
  const table = standings(ids, resultRows(matches), { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss }, t.tiebreak);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-start">#</th>
              <th className="py-2 text-start">بازیکن</th>
              <th className="py-2" title="بازی">ب</th>
              <th className="py-2" title="برد">بر</th>
              <th className="py-2" title="مساوی">م</th>
              <th className="py-2" title="باخت">با</th>
              <th className="py-2" title="تفاضل گل">تف</th>
              <th className="py-2" title="امتیاز">امتیاز</th>
            </tr>
          </thead>
          <tbody>
            {table.map((s, i) => (
              <tr key={s.id} className={cn("border-b last:border-0", qualify > 0 && i < qualify && "bg-success-soft/60")}>
                <td className="py-2">{fa(i + 1)}</td>
                <td className="py-2 font-medium">{names.get(s.id)}</td>
                <td className="py-2 text-center">{fa(s.played)}</td>
                <td className="py-2 text-center">{fa(s.won)}</td>
                <td className="py-2 text-center">{fa(s.drawn)}</td>
                <td className="py-2 text-center">{fa(s.lost)}</td>
                <td className="ltr py-2 text-center">{s.goalDiff > 0 ? `+${fa(s.goalDiff)}` : fa(s.goalDiff)}</td>
                <td className="py-2 text-center font-black">{fa(s.points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {qualify > 0 ? <p className="mt-2 text-xs text-muted-foreground">ردیف‌های سبز به مرحلهٔ بعد صعود می‌کنند.</p> : null}
      </CardContent>
    </Card>
  );
}

function RoundsCard({ matches, names, onPick, pickable, pickLabel, compact = false, roundWord = "هفتهٔ" }: Ctx & { matches: Match[]; compact?: boolean; roundWord?: string }) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">بازی‌ها</CardTitle></CardHeader>
      <CardContent className={cn("space-y-4", compact && "max-h-[28rem] overflow-y-auto")}>
        {rounds.map((r) => (
          <div key={r} className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground">{roundWord} {fa(r)}</p>
            <div className="flex flex-wrap gap-2">
              {matches.filter((m) => m.round === r).map((m) => <MatchCard key={m.id} m={m} names={names} onPick={onPick} pickable={pickable} pickLabel={pickLabel} />)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, quiet = false) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      if (!quiet) toast.success(res.message);
      router.refresh();
    });
  return { pending, run };
}

function SwissSection({ t, manage, names, onPick, pickable, pickLabel }: Ctx & { t: TournamentView; manage: boolean }) {
  const { pending, run } = useRun();
  const sw = t.matches.filter((m) => m.stage === "SWISS");
  const planned = t.swissRounds ?? swissRoundCount(t.participants.length);
  const current = Math.max(0, ...sw.map((m) => m.round));
  const left = sw.filter((m) => m.round === current && m.status === "PENDING").length;
  const out = new Set(t.participants.filter((p) => p.disqualifiedAt).map((p) => p.id));
  const byes = sw.filter((m) => m.player2Bye && m.player1Id).map((m) => m.player1Id!);
  const table = swissStandings(t.participants.map((p) => p.id), resultRows(sw), byes, { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss });
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">جدول سوئیسی — دور {fa(current)} از {fa(planned)}</CardTitle>
          {manage && t.status === "IN_PROGRESS" && current < planned ? (
            <Button size="sm" disabled={left > 0} loading={pending} onClick={() => run(() => nextSwissRound(t.id))} title={left > 0 ? "ابتدا نتیجهٔ همهٔ بازی‌های این دور را ثبت کنید" : undefined}>
              <Shuffle /> جفت کردن دور {fa(current + 1)}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {manage && t.status === "IN_PROGRESS" && left > 0 ? <p className="mb-2 text-xs text-muted-foreground">{fa(left)} بازی از این دور مانده است؛ بعد از ثبت همه، دور بعد را جفت کنید.</p> : null}
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 text-start">#</th>
                <th className="py-2 text-start">بازیکن</th>
                <th className="py-2" title="برد">بر</th>
                <th className="py-2" title="مساوی">م</th>
                <th className="py-2" title="باخت">با</th>
                <th className="py-2" title="استراحت (برد خودکار)">است</th>
                <th className="py-2" title="مجموع امتیاز حریفان (بوخهولتز) — معیار رتبه در امتیاز مساوی">بوخهولتز</th>
                <th className="py-2">امتیاز</th>
              </tr>
            </thead>
            <tbody>
              {table.map((s, i) => (
                <tr key={s.id} className={cn("border-b last:border-0", out.has(s.id) && "text-muted-foreground")}>
                  <td className="py-2">{fa(i + 1)}</td>
                  <td className="py-2 font-medium">{names.get(s.id)}{out.has(s.id) ? <span className="ms-1 text-xs">(حذف‌شده)</span> : null}</td>
                  <td className="py-2 text-center">{fa(s.won)}</td>
                  <td className="py-2 text-center">{fa(s.drawn)}</td>
                  <td className="py-2 text-center">{fa(s.lost)}</td>
                  <td className="py-2 text-center">{fa(s.byes)}</td>
                  <td className="py-2 text-center">{fa(s.buchholz)}</td>
                  <td className="py-2 text-center font-black">{fa(s.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">در هر دور بازیکنان هم‌امتیاز با هم بازی می‌کنند و کسی دو بار با یک نفر بازی نمی‌کند. در امتیاز مساوی، بوخهولتز (قدرت حریفان) تعیین‌کننده است.</p>
        </CardContent>
      </Card>
      <RoundsCard matches={sw} names={names} onPick={onPick} pickable={pickable} pickLabel={pickLabel} roundWord="دور" />
    </>
  );
}

function LeaderboardSection({ t, manage }: { t: TournamentView; manage: boolean }) {
  const { pending, run } = useRun();
  const names = new Map(t.participants.map((p) => [p.id, p.name]));
  const rounds = Array.from({ length: t.leaderboardRounds ?? 1 }, (_, i) => i + 1);
  const table = leaderboardTable(t.participants.map((p) => p.id), t.points);
  const editable = manage && t.status === "IN_PROGRESS";
  // While editing keep the entry order so rows don't jump under the cursor.
  const rows = editable ? t.participants.map((p) => table.find((r) => r.id === p.id)!) : table;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">جدول امتیاز</CardTitle>
        {manage ? (
          <div className="flex flex-wrap gap-2 print:hidden">
            {editable ? <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => addLeaderboardRound(t.id))}><Plus /> افزودن دور</Button> : null}
            {t.status === "IN_PROGRESS" ? <Button size="sm" loading={pending} onClick={() => run(() => finishLeaderboard(t.id, true))}><CheckCircle2 /> پایان و ثبت رتبه‌ها</Button> : null}
            {t.status === "COMPLETED" ? <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => finishLeaderboard(t.id, false))}><RotateCcw /> بازگشایی برای اصلاح</Button> : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {editable ? <p className="mb-2 text-xs text-muted-foreground">امتیاز هر نفر در هر دور را بنویسید؛ با خروج از خانه ذخیره می‌شود. خالی = بدون امتیاز.</p> : null}
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-start">رتبه</th>
              <th className="py-2 text-start">بازیکن</th>
              {rounds.map((r) => <th key={r} className="px-1 py-2 whitespace-nowrap">دور {fa(r)}</th>)}
              <th className="py-2">جمع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={cn("border-b last:border-0", !editable && row.rank === 1 && row.total > 0 && "bg-warning-soft/50")}>
                <td className="py-2">{fa(row.rank)}</td>
                <td className="py-2 font-medium whitespace-nowrap">{names.get(row.id)}</td>
                {rounds.map((r) => {
                  const v = row.byRound.get(r);
                  return (
                    <td key={r} className="px-1 py-1 text-center">
                      {editable ? <PointsCell key={`${row.id}-${r}-${v ?? ""}`} tournamentId={t.id} participantId={row.id} round={r} value={v} label={`${names.get(row.id)} — دور ${fa(r)}`} /> : v === undefined ? <span className="text-muted-foreground">—</span> : fa(v)}
                    </td>
                  );
                })}
                <td className="py-2 text-center font-black">{fa(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function PointsCell({ tournamentId, participantId, round, value, label }: { tournamentId: string; participantId: string; round: number; value: number | undefined; label: string }) {
  const { pending, run } = useRun();
  const initial = value === undefined ? "" : String(value);
  return (
    <Input
      aria-label={label}
      defaultValue={initial}
      inputMode="numeric"
      dir="ltr"
      disabled={pending}
      className="mx-auto h-8 w-16 px-1 text-center"
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      onBlur={(e) => {
        const next = e.currentTarget.value.trim();
        if (next === initial) return;
        run(() => setLeaderboardPoints(tournamentId, { participantId, round, points: next }), true);
      }}
    />
  );
}

function StartKnockout({ t }: { t: TournamentView }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const left = t.matches.filter((m) => m.stage === "GROUP" && m.status === "PENDING").length;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{left > 0 ? `${fa(left)} بازی گروهی باقی مانده است.` : "همهٔ بازی‌های گروهی تمام شده‌اند."}</p>
        <Button
          disabled={left > 0}
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await startKnockout(t.id);
              if (!res.ok) return void toast.error(res.error);
              toast.success(res.message);
              router.refresh();
            })
          }
        >
          <Swords /> شروع مرحلهٔ حذفی
        </Button>
      </CardContent>
    </Card>
  );
}

function ReportDialog({ m, names, onClose }: { m: Match; names: Map<string, string>; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"score" | "sets" | "forfeit">(m.forfeit ? "forfeit" : m.setScores ? "sets" : "score");
  const [s1, setS1] = React.useState(m.forfeit || m.setScores ? "" : (m.score1?.toString() ?? ""));
  const [s2, setS2] = React.useState(m.forfeit || m.setScores ? "" : (m.score2?.toString() ?? ""));
  const [sets, setSets] = React.useState(m.setScores?.replaceAll(",", ", ") ?? "");
  const [winner, setWinner] = React.useState<1 | 2 | null>((m.winnerSlot as 1 | 2 | null) ?? null);
  const [note, setNote] = React.useState(m.note ?? "");
  const [station, setStation] = React.useState(m.station ?? "");
  const [when, setWhen] = React.useState(isoToTehranInput(m.scheduledAt ? new Date(m.scheduledAt).toISOString() : null));
  const [pending, startTransition] = React.useTransition();
  const p1 = names.get(m.player1Id ?? "") ?? "—";
  const p2 = names.get(m.player2Id ?? "") ?? "—";
  const elimination = isEliminationStage(m.stage);
  const tie = mode === "score" && s1 !== "" && s1 === s2;
  const needsWinner = mode === "forfeit" || (elimination && tie);
  const underway = !!m.underwayAt && m.status === "PENDING";

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, close = true) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      if (close) onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>بازی #{fa(m.number)}: {p1} — {p2}</DialogTitle>
          <DialogDescription>{STAGE_LABELS[m.stage]}</DialogDescription>
        </DialogHeader>

        {m.status === "PENDING" && m.claimBySlot ? (
          <div className="grid gap-2 rounded-xl border border-warning/50 bg-warning-soft/50 p-3 text-sm">
            <p className="font-bold">گزارش {m.claimBySlot === 1 ? p1 : p2}: <span className="ltr inline-block">{m.claimScore1 ?? "?"} - {m.claimScore2 ?? "?"}</span></p>
            {m.claimSetScores ? <p className="text-xs">دست‌ها: <span className="ltr inline-block">{m.claimSetScores.replaceAll(",", "  ")}</span></p> : null}
            {m.claimWinnerSlot ? <p className="text-xs">برنده: {m.claimWinnerSlot === 1 ? p1 : p2}</p> : null}
            {m.claimNote ? <p className="text-xs text-muted-foreground">{m.claimNote}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={() => run(() => confirmMatchClaim(m.id))}>تأیید و ثبت همین نتیجه</Button>
              <Button type="button" size="sm" variant="outline" className="text-destructive" disabled={pending} onClick={() => run(() => rejectMatchClaim(m.id), false)}>رد گزارش</Button>
            </div>
          </div>
        ) : null}

        {m.status === "PENDING" ? (
          <div className="grid gap-3 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">وضعیت و مشخصات</p>
              <Button type="button" size="sm" variant={underway ? "secondary" : "outline"} disabled={pending} onClick={() => run(() => setMatchUnderway(m.id, !underway), false)}>
                {underway ? "برداشتن «در حال بازی»" : "شروع بازی (در حال بازی)"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="station" className="text-xs">دستگاه / میز</Label>
                <Input id="station" value={station} maxLength={40} onChange={(e) => setStation(e.target.value)} placeholder="مثلاً PS5 شماره ۳" />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="when" className="text-xs">زمان بازی (تهران)</Label>
                <Input id="when" type="datetime-local" dir="ltr" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" className="justify-self-start" disabled={pending} onClick={() => run(() => setMatchDetails(m.id, { station, scheduledAt: tehranInputToIso(when) }), false)}>
              <Clock /> ذخیرهٔ مشخصات
            </Button>
          </div>
        ) : null}

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              reportMatch(m.id, {
                score1: mode === "score" ? s1 : "",
                score2: mode === "score" ? s2 : "",
                setScores: mode === "sets" ? sets : "",
                forfeit: mode === "forfeit",
                winnerSlot: needsWinner || (mode === "sets" && elimination) ? (winner ?? undefined) : undefined,
                note,
              }),
            );
          }}
        >
          <div role="tablist" aria-label="نوع نتیجه" className="flex overflow-hidden rounded-lg border text-sm font-semibold">
            {([["score", "امتیاز"], ["sets", "چند دست (ست)"], ["forfeit", "برد فنی"]] as const).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={cn("flex-1 px-3 py-2", mode === k ? "bg-strong text-strong-foreground" : "hover:bg-secondary")}>{label}</button>
            ))}
          </div>
          {mode === "score" ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="s1" className="truncate">{p1}</Label>
                <Input id="s1" inputMode="numeric" dir="ltr" className="text-center text-lg" value={s1} onChange={(e) => setS1(e.target.value)} required />
              </div>
              <span className="pb-3 text-muted-foreground">–</span>
              <div className="grid gap-1.5">
                <Label htmlFor="s2" className="truncate">{p2}</Label>
                <Input id="s2" inputMode="numeric" dir="ltr" className="text-center text-lg" value={s2} onChange={(e) => setS2(e.target.value)} required />
              </div>
            </div>
          ) : mode === "sets" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="sets">نتیجهٔ هر دست ({p1} – {p2})</Label>
              <Input id="sets" dir="ltr" value={sets} onChange={(e) => setSets(e.target.value)} placeholder="3-1, 2-3, 5-4" required />
              <p className="text-xs text-muted-foreground">مثلاً برای «بهترین از ۳»: 3-1, 2-3, 5-4. برندهٔ هر دست شمرده می‌شود و نتیجهٔ بازی همان تعداد دست‌های برده است.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">برد بدون بازی (مثلاً حریف نیامد). امتیازی ثبت نمی‌شود.</p>
          )}
          {needsWinner || (mode === "sets" && elimination) ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{mode === "forfeit" ? "برنده" : "برنده (اگر مساوی شد)"}</legend>
              {([1, 2] as const).map((slot) => (
                <label key={slot} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="radio" name="winner" checked={winner === slot} onChange={() => setWinner(slot)} className="size-4 accent-[var(--brand-green-dark)]" />
                  {slot === 1 ? p1 : p2}
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="note">یادداشت (اختیاری)</Label>
            <Input id="note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً پنالتی ۴-۳" />
          </div>
          <DialogFooter className="gap-2">
            {m.status === "COMPLETED" ? (
              <Button type="button" variant="outline" className="text-destructive" disabled={pending} onClick={() => run(() => clearMatch(m.id))}>پاک کردن نتیجه</Button>
            ) : null}
            <Button type="submit" loading={pending}>ثبت نتیجه</Button>
          </DialogFooter>
        </form>
        {m.status === "COMPLETED" ? <Badge variant="success" className="w-fit">نتیجه ثبت شده؛ با ثبت دوباره اصلاح می‌شود.</Badge> : null}
      </DialogContent>
    </Dialog>
  );
}

/** A player reports their own match (or confirms the opponent's report). */
function PlayerReportDialog({ m, names, mySlot, onClose }: { m: Match; names: Map<string, string>; mySlot: 1 | 2; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [s1, setS1] = React.useState("");
  const [s2, setS2] = React.useState("");
  const [winner, setWinner] = React.useState<1 | 2 | null>(null);
  const [note, setNote] = React.useState("");
  const p1 = names.get(m.player1Id ?? "") ?? "—";
  const p2 = names.get(m.player2Id ?? "") ?? "—";
  const theirs = m.claimBySlot && m.claimBySlot !== mySlot;
  const mine = m.claimBySlot === mySlot;
  const tie = s1 !== "" && s1 === s2 && isEliminationStage(m.stage);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      onClose();
      router.refresh();
    });
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>گزارش نتیجه: {p1} — {p2}</DialogTitle>
          <DialogDescription>نتیجه وقتی ثبت می‌شود که حریف یا برگزارکننده تأیید کند. اگر هر دو یک نتیجه را بفرستید، خودکار ثبت می‌شود.</DialogDescription>
        </DialogHeader>
        {theirs ? (
          <div className="grid gap-2 rounded-xl border border-warning/50 bg-warning-soft/50 p-3 text-sm">
            <p className="font-bold">حریف این نتیجه را گزارش کرده: <span className="ltr inline-block">{m.claimScore1} - {m.claimScore2}</span> ({p1} – {p2})</p>
            <Button type="button" size="sm" className="justify-self-start" loading={pending} onClick={() => run(() => confirmMatchClaim(m.id))}>درست است، تأیید می‌کنم</Button>
            <p className="text-xs text-muted-foreground">اگر درست نیست، نتیجهٔ خودتان را پایین بفرستید تا برگزارکننده بررسی کند.</p>
          </div>
        ) : mine ? (
          <p className="rounded-xl bg-info-soft p-3 text-sm text-info">گزارش شما (<span className="ltr inline-block">{m.claimScore1} - {m.claimScore2}</span>) منتظر تأیید است. می‌توانید آن را با نتیجهٔ جدید جایگزین کنید.</p>
        ) : null}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => claimMatchResult(m.id, { score1: s1, score2: s2, winnerSlot: tie ? (winner ?? undefined) : undefined, note }));
          }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="c1" className="truncate">{p1}</Label>
              <Input id="c1" inputMode="numeric" dir="ltr" className="text-center text-lg" value={s1} onChange={(e) => setS1(e.target.value)} required />
            </div>
            <span className="pb-3 text-muted-foreground">–</span>
            <div className="grid gap-1.5">
              <Label htmlFor="c2" className="truncate">{p2}</Label>
              <Input id="c2" inputMode="numeric" dir="ltr" className="text-center text-lg" value={s2} onChange={(e) => setS2(e.target.value)} required />
            </div>
          </div>
          {tie ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">برنده (مساوی در بازی حذفی)</legend>
              {([1, 2] as const).map((slot) => (
                <label key={slot} className="flex items-center gap-2 text-sm"><input type="radio" name="cwinner" checked={winner === slot} onChange={() => setWinner(slot)} className="size-4 accent-[var(--brand-green-dark)]" /> {slot === 1 ? p1 : p2}</label>
              ))}
            </fieldset>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="cnote">توضیح (اختیاری)</Label>
            <Input id="cnote" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter><Button type="submit" loading={pending}>ارسال نتیجه</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
