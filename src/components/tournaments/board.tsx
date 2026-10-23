"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, Medal, Swords } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearMatch, reportMatch, startKnockout } from "@/features/tournaments/actions";
import { groupName, isEliminationStage, STAGE_LABELS } from "@/features/tournaments/constants";
import { eliminationRoundName, standings } from "@/features/tournaments/engine";
import type { TournamentView } from "@/features/tournaments/queries";
import { cn } from "@/lib/utils";

type Match = TournamentView["matches"][number];
const fa = (n: number) => n.toLocaleString("fa-IR");

interface BoardProps {
  t: TournamentView;
  manage?: boolean;
}

/** Bracket / tables / matches for every format. `manage` adds result entry for the organizer. */
export function TournamentBoard({ t, manage = false }: BoardProps) {
  const names = React.useMemo(() => new Map(t.participants.map((p) => [p.id, p.name])), [t.participants]);
  const [editing, setEditing] = React.useState<Match | null>(null);
  const canEdit = manage && (t.status === "IN_PROGRESS" || t.status === "COMPLETED");
  const onPick = canEdit ? (m: Match) => setEditing(m) : undefined;
  const ctx = { names, onPick };

  if (t.matches.length === 0) {
    return <p className="rounded-xl border border-dashed bg-surface/60 p-8 text-center text-sm text-muted-foreground">جدول بازی‌ها پس از شروع تورنومنت ساخته می‌شود.</p>;
  }

  return (
    <div className="space-y-6">
      <Podium t={t} />
      {t.format === "SINGLE_ELIMINATION" ? <EliminationSection title="جدول حذفی" matches={t.matches.filter((m) => m.stage === "WINNERS")} third={t.matches.find((m) => m.stage === "THIRD_PLACE")} {...ctx} /> : null}

      {t.format === "DOUBLE_ELIMINATION" ? (
        <>
          <EliminationSection title={STAGE_LABELS.WINNERS} matches={t.matches.filter((m) => m.stage === "WINNERS")} roundLabel={(r) => `دور ${fa(r)}`} {...ctx} />
          <EliminationSection title={STAGE_LABELS.LOSERS} matches={t.matches.filter((m) => m.stage === "LOSERS")} roundLabel={(r) => `دور ${fa(r)}`} {...ctx} />
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
}

function EliminationSection({ title, matches, third, roundLabel, names, onPick }: Ctx & { title: string; matches: Match[]; third?: Match; roundLabel?: (r: number) => string }) {
  if (matches.length === 0) return null;
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const total = rounds.length;
  const firstCount = Math.max(...rounds.map((r) => matches.filter((m) => m.round === r).length));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-6" style={{ minHeight: `${firstCount * 92}px` }}>
            {rounds.map((r) => (
              <div key={r} className="flex min-w-52 flex-col">
                <p className="mb-2 text-center text-xs font-bold text-muted-foreground">{roundLabel ? roundLabel(r) : eliminationRoundName(r, total)}</p>
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {matches.filter((m) => m.round === r).sort((a, b) => a.position - b.position).map((m) => <MatchCard key={m.id} m={m} names={names} onPick={onPick} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
        {third ? (
          <div className="mt-4 space-y-1 border-t pt-4">
            <p className="text-xs font-bold text-muted-foreground">{STAGE_LABELS.THIRD_PLACE}</p>
            <MatchCard m={third} names={names} onPick={onPick} />
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

function MatchCard({ m, names, onPick }: { m: Match } & Ctx) {
  const isBye = m.player1Bye || m.player2Bye;
  const playable = !!onPick && !isBye && !!m.player1Id && !!m.player2Id && m.status !== "SKIPPED";
  const row = (slot: 1 | 2) => {
    const l = slotLabel(m, slot, names);
    const won = m.status === "COMPLETED" && m.winnerSlot === slot && !isBye;
    const score = slot === 1 ? m.score1 : m.score2;
    return (
      <div className={cn("flex items-center justify-between gap-2 px-3 py-1.5", won && "bg-success-soft font-bold")}>
        <span className={cn("truncate text-sm", l.muted && "text-muted-foreground italic")}>{l.text}</span>
        <span className={cn("ltr min-w-6 text-center text-sm tabular-nums", won ? "text-success" : "text-muted-foreground")}>{score === null ? "" : fa(score)}</span>
      </div>
    );
  };
  const body = (
    <>
      <div className="flex items-center justify-between border-b px-3 py-0.5 text-[10px] text-muted-foreground">
        <span>#{fa(m.number)}</span>
        {m.note ? <span className="truncate">{m.note}</span> : null}
        {playable && m.status === "PENDING" ? <span className="font-bold text-link">ثبت نتیجه</span> : null}
      </div>
      {row(1)}
      <div className="border-t" />
      {row(2)}
    </>
  );
  const cls = cn("w-52 overflow-hidden rounded-lg border bg-surface text-start shadow-sm", isBye && "opacity-60");
  return playable ? (
    <button type="button" onClick={() => onPick!(m)} className={cn(cls, "cursor-pointer transition-shadow hover:border-brand-green hover:shadow-md")} aria-label={`نتیجهٔ بازی ${fa(m.number)}`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function StandingsCard({ title, ids, matches, t, names, qualify = 0 }: { title: string; ids: string[]; matches: Match[]; t: TournamentView; names: Map<string, string>; qualify?: number }) {
  const table = standings(
    ids,
    matches.filter((m) => m.status === "COMPLETED" && m.player1Id && m.player2Id && m.score1 !== null && m.score2 !== null).map((m) => ({ player1: m.player1Id!, player2: m.player2Id!, score1: m.score1!, score2: m.score2! })),
    { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss },
  );
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

function RoundsCard({ matches, names, onPick, compact = false }: Ctx & { matches: Match[]; compact?: boolean }) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">بازی‌ها</CardTitle></CardHeader>
      <CardContent className={cn("space-y-4", compact && "max-h-[28rem] overflow-y-auto")}>
        {rounds.map((r) => (
          <div key={r} className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground">هفتهٔ {fa(r)}</p>
            <div className="flex flex-wrap gap-2">
              {matches.filter((m) => m.round === r).map((m) => <MatchCard key={m.id} m={m} names={names} onPick={onPick} />)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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
  const [s1, setS1] = React.useState(m.score1?.toString() ?? "");
  const [s2, setS2] = React.useState(m.score2?.toString() ?? "");
  const [winner, setWinner] = React.useState<1 | 2 | null>((m.winnerSlot as 1 | 2 | null) ?? null);
  const [note, setNote] = React.useState(m.note ?? "");
  const [pending, startTransition] = React.useTransition();
  const p1 = names.get(m.player1Id ?? "") ?? "—";
  const p2 = names.get(m.player2Id ?? "") ?? "—";
  const elimination = isEliminationStage(m.stage);
  const tie = s1 !== "" && s1 === s2;

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>نتیجهٔ بازی #{fa(m.number)}</DialogTitle>
          <DialogDescription>{STAGE_LABELS[m.stage]}{elimination ? " — در تساوی، برنده را انتخاب کنید (مثلاً پنالتی)." : ""}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => reportMatch(m.id, { score1: s1, score2: s2, winnerSlot: elimination && tie ? (winner ?? undefined) : undefined, note }));
          }}
        >
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
          {elimination && tie ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">برنده (مساوی)</legend>
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
