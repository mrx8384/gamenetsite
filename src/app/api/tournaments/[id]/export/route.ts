import { getCurrentUser } from "@/lib/auth/dal";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { FORMAT_LABELS, groupName, STAGE_LABELS } from "@/features/tournaments/constants";
import { leaderboardTable } from "@/features/tournaments/engine";
import { manageableTournament } from "@/features/tournaments/permissions";
import { readAnswers, readSignupQuestions } from "@/features/tournaments/schemas";

/** Organizer download: participants (with sign-up answers), matches or standings as CSV for Excel. */
export async function GET(req: Request, { params }: RouteContext<"/api/tournaments/[id]/export">) {
  const { id } = await params;
  const user = await getCurrentUser();
  const t = user ? await manageableTournament(user, id) : null;
  if (!t) return new Response("Not found", { status: 404 });
  const kind = new URL(req.url).searchParams.get("kind");
  const participants = await db.tournamentParticipant.findMany({ where: { tournamentId: id }, orderBy: { seed: "asc" } });
  const name = new Map(participants.map((p) => [p.id, p.name]));
  let rows: (string | number | null)[][];

  if (kind === "participants") {
    const questions = readSignupQuestions(t.signupQuestions).map((q) => q.label);
    const extra = [...new Set([...questions, ...participants.flatMap((p) => readAnswers(p.answers).map((a) => a.q))])];
    rows = [
      ["سید", t.teamSize ? "نام تیم" : "نام", "اعضا", "ثبت‌نام", "حضور (چک‌این)", "گروه", "رتبهٔ نهایی", "حذف‌شده", ...extra],
      ...participants.map((p) => {
        const ans = new Map(readAnswers(p.answers).map((a) => [a.q, a.a]));
        return [p.seed, p.name, p.members.join("، "), p.userId ? "آنلاین" : "دستی", p.checkedInAt ? "بله" : "", p.groupIndex !== null ? groupName(p.groupIndex) : "", p.finalRank, p.disqualifiedAt ? "بله" : "", ...extra.map((q) => ans.get(q) ?? "")];
      }),
    ];
  } else if (kind === "matches") {
    const matches = await db.tournamentMatch.findMany({ where: { tournamentId: id }, orderBy: { number: "asc" } });
    const status = (m: (typeof matches)[number]) => (m.status === "COMPLETED" ? "انجام‌شده" : m.status === "SKIPPED" ? "لازم نشد" : m.underwayAt ? "در حال بازی" : "در انتظار");
    rows = [
      ["شماره", "مرحله", "دور", "گروه", "بازیکن ۱", "بازیکن ۲", "امتیاز ۱", "امتیاز ۲", "دست‌ها", "برنده", "وضعیت", "برد فنی", "دستگاه", "یادداشت"],
      ...matches.map((m) => [
        m.number,
        STAGE_LABELS[m.stage] ?? m.stage,
        m.round,
        m.groupIndex !== null ? groupName(m.groupIndex) : "",
        m.player1Bye ? "استراحت" : (name.get(m.player1Id ?? "") ?? ""),
        m.player2Bye ? "استراحت" : (name.get(m.player2Id ?? "") ?? ""),
        m.score1,
        m.score2,
        m.setScores ?? "",
        m.winnerSlot === 1 ? (name.get(m.player1Id ?? "") ?? "") : m.winnerSlot === 2 ? (name.get(m.player2Id ?? "") ?? "") : m.status === "COMPLETED" ? "مساوی" : "",
        status(m),
        m.forfeit ? "بله" : "",
        m.station ?? "",
        m.note ?? "",
      ]),
    ];
  } else if (kind === "standings") {
    if (t.format === "LEADERBOARD") {
      const pts = await db.tournamentPoints.findMany({ where: { tournamentId: id } });
      const rounds = Array.from({ length: t.leaderboardRounds ?? 1 }, (_, i) => i + 1);
      rows = [["رتبه", "نام", ...rounds.map((r) => `دور ${r}`), "جمع"], ...leaderboardTable(participants.map((p) => p.id), pts).map((r) => [r.rank, name.get(r.id) ?? "", ...rounds.map((x) => r.byRound.get(x) ?? null), r.total])];
    } else {
      const sorted = [...participants].sort((a, b) => (a.finalRank ?? 9999) - (b.finalRank ?? 9999) || a.seed - b.seed);
      rows = [["رتبهٔ نهایی", "نام", "سید"], ...sorted.map((p) => [p.finalRank, p.name, p.seed])];
    }
  } else {
    return new Response("Unknown export", { status: 400 });
  }

  const file = `tournament-${t.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "export"}-${kind}.csv`;
  return new Response(toCsv([[`${t.name} — ${FORMAT_LABELS[t.format]}`], ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
