"use client";

import * as React from "react";
import Link from "next/link";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPredictionBoard, predictMatch, type PredictionBoard } from "@/features/tournaments/community-actions";
import type { TournamentView } from "@/features/tournaments/queries";
import { cn } from "@/lib/utils";

const fa = (n: number) => n.toLocaleString("fa-IR");

/** Visitors predict the winner of each open match; the best predictors are listed. */
export function PredictionsPanel({ t, viewerParticipantId = null }: { t: TournamentView; viewerParticipantId?: string | null }) {
  const [board, setBoard] = React.useState<PredictionBoard | null>(null);
  const [pending, startTransition] = React.useTransition();
  // Reload whenever the (refreshed) tournament data changes.
  const version = t.matches.map((m) => `${m.id}:${m.status}:${m.player1Id}:${m.player2Id}:${m.underwayAt ? 1 : 0}`).join("|");
  React.useEffect(() => {
    let alive = true;
    void getPredictionBoard(t.id).then((b) => alive && setBoard(b));
    return () => {
      alive = false;
    };
  }, [t.id, version]);

  if (!board) return null;
  const names = new Map(t.participants.map((p) => [p.id, p.name]));
  const open = t.matches.filter((m) => m.status === "PENDING" && m.player1Id && m.player2Id && !m.player1Bye && !m.player2Bye && !m.underwayAt);
  const pick = (matchId: string, participantId: string) =>
    startTransition(async () => {
      const res = await predictMatch(matchId, participantId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setBoard(await getPredictionBoard(t.id));
    });

  return (
    <Card className="print:hidden">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="size-5 text-success" /> پیش‌بینی نتایج</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {!board.loggedIn ? (
            <p className="text-sm">برای پیش‌بینی <Link href={`/login?next=${encodeURIComponent(`/tournaments/${t.slug}`)}`} className="font-bold text-link hover:underline">وارد حساب کاربری شوید</Link>.</p>
          ) : (
            <p className="text-xs text-muted-foreground">برندهٔ هر بازی را قبل از شروعش انتخاب کنید؛ تا شروع بازی می‌توانید نظرتان را عوض کنید.</p>
          )}
          {open.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">الان بازی‌ای برای پیش‌بینی باز نیست.</p>
          ) : (
            <ul className="space-y-2">
              {open.map((m) => {
                const c = board.counts[m.id] ?? {};
                const total = (c[m.player1Id!] ?? 0) + (c[m.player2Id!] ?? 0);
                const own = !!viewerParticipantId && (m.player1Id === viewerParticipantId || m.player2Id === viewerParticipantId);
                return (
                  <li key={m.id} className="rounded-xl border p-2">
                    <p className="mb-1 text-[11px] text-muted-foreground">بازی #{fa(m.number)}{total ? ` · ${fa(total)} پیش‌بینی` : ""}{own ? " · بازی خودتان" : ""}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[m.player1Id!, m.player2Id!].map((pid) => {
                        const share = total ? Math.round(((c[pid] ?? 0) / total) * 100) : null;
                        const chosen = board.mine[m.id] === pid;
                        return (
                          <Button
                            key={pid}
                            type="button"
                            variant={chosen ? "default" : "outline"}
                            size="sm"
                            className={cn("h-auto min-w-0 justify-between gap-2 py-2", chosen && "ring-2 ring-brand-green/40")}
                            disabled={pending || !board.loggedIn || own}
                            aria-pressed={chosen}
                            onClick={() => pick(m.id, pid)}
                          >
                            <span className="truncate">{names.get(pid)}</span>
                            {share !== null ? <span className="shrink-0 text-xs opacity-80">{fa(share)}٪</span> : null}
                          </Button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold">بهترین پیش‌بینی‌کننده‌ها</p>
          {board.top.length === 0 ? (
            <p className="text-sm text-muted-foreground">بعد از ثبت اولین نتیجه‌ها نمایش داده می‌شود.</p>
          ) : (
            <ol className="divide-y rounded-xl border text-sm">
              {board.top.map((r, i) => (
                <li key={i} className={cn("flex items-center gap-2 px-3 py-1.5", r.me && "bg-success-soft font-bold")}>
                  <span className="w-6 text-muted-foreground">{fa(i + 1)}</span>
                  <span className="flex-1 truncate">{r.name}{r.me ? " (شما)" : ""}</span>
                  <span className="text-xs">{fa(r.correct)} از {fa(r.decided)}</span>
                </li>
              ))}
            </ol>
          )}
          {board.myScore ? <p className="text-xs text-muted-foreground">امتیاز شما: {fa(board.myScore.correct)} پیش‌بینی درست از {fa(board.myScore.decided)}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
