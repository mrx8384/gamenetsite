import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isEliminationStage } from "./constants";
import { markEntryForRefund } from "./entries";
import {
  applyResult,
  BracketError,
  clearResult,
  doubleElimination,
  groupStage,
  knockoutSeeds,
  type LiveMatch,
  type MatchSpec,
  resolveByes,
  roundRobin,
  singleElimination,
  type Stage,
  standings,
  toLive,
} from "./engine";

type Tx = Prisma.TransactionClient;

export class TournamentError extends Error {}

const STAGE_ORDER: Record<Stage, number> = { GROUP: 0, ROUND_ROBIN: 0, WINNERS: 1, LOSERS: 2, THIRD_PLACE: 3, GRAND_FINAL: 4, GRAND_FINAL_RESET: 5 };

/** Serializes all bracket changes of one tournament. */
async function lockTournament(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM tournaments WHERE id = ${id} FOR UPDATE`;
  const t = await tx.tournament.findUnique({ where: { id } });
  if (!t) throw new TournamentError("تورنومنت پیدا نشد.");
  return t;
}

/** Persists generated specs (after resolving byes), numbering matches from `startNumber`. */
async function persistSpecs(tx: Tx, tournamentId: string, specs: MatchSpec[], startNumber: number) {
  const ids = new Map(specs.map((s) => [s.key, randomUUID()]));
  const live = toLive(specs);
  resolveByes(live);
  const ordered = [...specs].sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || (a.groupIndex ?? 0) - (b.groupIndex ?? 0) || a.round - b.round || a.position - b.position);
  await tx.tournamentMatch.createMany({
    data: ordered.map((s, i) => {
      const l = live.get(s.key)!;
      const winnerId = l.status === "COMPLETED" && l.winnerSlot ? (l.winnerSlot === 1 ? l.player1 : l.player2) : null;
      return {
        id: ids.get(s.key)!,
        tournamentId,
        stage: s.stage,
        round: s.round,
        position: s.position,
        groupIndex: s.groupIndex,
        number: startNumber + i,
        player1Id: l.player1,
        player2Id: l.player2,
        player1Bye: l.player1Bye,
        player2Bye: l.player2Bye,
        status: l.status,
        winnerSlot: l.winnerSlot,
        winnerId,
        nextMatchId: s.next ? ids.get(s.next.key)! : null,
        nextSlot: s.next?.slot ?? null,
        loserMatchId: s.loser ? ids.get(s.loser.key)! : null,
        loserSlot: s.loser?.slot ?? null,
        completedAt: l.status === "COMPLETED" ? new Date() : null,
      };
    }),
  });
}

export async function startTournament(id: string) {
  return db.$transaction(async (tx) => {
    const t = await lockTournament(tx, id);
    if (t.status !== "DRAFT" && t.status !== "REGISTRATION") throw new TournamentError("این تورنومنت قبلاً شروع شده است.");
    let removed = 0;
    if (t.checkInMinutes !== null) {
      // Check-in: players who did not confirm attendance are removed (paid ones get a refund record).
      const absent = await tx.tournamentParticipant.findMany({ where: { tournamentId: id, checkedInAt: null }, select: { id: true } });
      for (const a of absent) await markEntryForRefund(tx, a.id, "حضور تأیید نشد (چک‌این)");
      removed = (await tx.tournamentParticipant.deleteMany({ where: { id: { in: absent.map((a) => a.id) } } })).count;
    }
    const participants = await tx.tournamentParticipant.findMany({ where: { tournamentId: id }, orderBy: [{ seed: "asc" }, { createdAt: "asc" }], select: { id: true } });
    const ids = participants.map((p) => p.id);
    if (ids.length < 2) throw new TournamentError("برای شروع حداقل ۲ شرکت‌کننده لازم است.");

    let specs: MatchSpec[];
    switch (t.format) {
      case "SINGLE_ELIMINATION":
        specs = singleElimination(ids, { thirdPlace: t.thirdPlaceMatch });
        break;
      case "DOUBLE_ELIMINATION":
        specs = doubleElimination(ids);
        break;
      case "ROUND_ROBIN":
        specs = roundRobin(ids, { double: t.doubleRoundRobin });
        break;
      case "GROUPS_KNOCKOUT": {
        const groupCount = t.groupCount ?? 1;
        if (ids.length < groupCount * 2) throw new TournamentError(`برای ${groupCount.toLocaleString("fa-IR")} گروه حداقل ${(groupCount * 2).toLocaleString("fa-IR")} شرکت‌کننده لازم است.`);
        const g = groupStage(ids, groupCount, t.doubleRoundRobin);
        for (const [gi, members] of g.groups.entries()) {
          await tx.tournamentParticipant.updateMany({ where: { id: { in: members } }, data: { groupIndex: gi } });
        }
        specs = g.matches;
        break;
      }
    }
    await tx.tournamentMatch.deleteMany({ where: { tournamentId: id } });
    await persistSpecs(tx, id, specs, 1);
    await tx.tournament.update({ where: { id }, data: { status: "IN_PROGRESS", startedAt: new Date(), knockoutStarted: false, completedAt: null } });
    await refreshCompletion(tx, id);
    return { removed };
  });
}

/** Back to registration: removes all matches and results (participants are kept). */
export async function resetTournament(id: string) {
  await db.$transaction(async (tx) => {
    await lockTournament(tx, id);
    await tx.tournamentMatch.deleteMany({ where: { tournamentId: id } });
    await tx.tournamentParticipant.updateMany({ where: { tournamentId: id }, data: { groupIndex: null, finalRank: null, disqualifiedAt: null } });
    await tx.tournament.update({ where: { id }, data: { status: "REGISTRATION", startedAt: null, completedAt: null, knockoutStarted: false } });
  });
}

type ScoredMatch = { status: string; player1Id: string | null; player2Id: string | null; score1: number | null; score2: number | null; forfeit?: boolean; winnerSlot?: number | null };

/** Completed matches as standings rows; a forfeit counts as a win/loss without goals. */
function resultRows(matches: ScoredMatch[]) {
  return matches
    .filter((m) => m.status === "COMPLETED" && m.player1Id && m.player2Id && ((m.score1 !== null && m.score2 !== null) || (m.forfeit && m.winnerSlot)))
    .map((m) => ({ player1: m.player1Id!, player2: m.player2Id!, score1: m.score1 ?? 0, score2: m.score2 ?? 0, winner: m.forfeit && (m.winnerSlot === 1 || m.winnerSlot === 2) ? (m.winnerSlot as 1 | 2) : undefined }));
}

function groupTables(t: { pointsWin: number; pointsDraw: number; pointsLoss: number }, participants: { id: string; seed: number; groupIndex: number | null }[], matches: (ScoredMatch & { stage: string; groupIndex: number | null })[]) {
  const groups = new Map<number, string[]>();
  for (const p of [...participants].sort((a, b) => a.seed - b.seed)) {
    if (p.groupIndex === null) continue;
    groups.set(p.groupIndex, [...(groups.get(p.groupIndex) ?? []), p.id]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([gi, members]) => ({
    groupIndex: gi,
    table: standings(
      members,
      resultRows(matches.filter((m) => m.stage === "GROUP" && m.groupIndex === gi)),
      { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss },
    ),
  }));
}

export async function startKnockout(id: string) {
  await db.$transaction(async (tx) => {
    const t = await lockTournament(tx, id);
    if (t.format !== "GROUPS_KNOCKOUT" || t.status !== "IN_PROGRESS") throw new TournamentError("این عملیات برای این تورنومنت ممکن نیست.");
    if (t.knockoutStarted) throw new TournamentError("مرحلهٔ حذفی قبلاً شروع شده است.");
    const matches = await tx.tournamentMatch.findMany({ where: { tournamentId: id } });
    if (matches.some((m) => m.stage === "GROUP" && m.status === "PENDING")) throw new TournamentError("ابتدا نتیجهٔ همهٔ بازی‌های گروهی را ثبت کنید.");
    const participants = await tx.tournamentParticipant.findMany({ where: { tournamentId: id }, select: { id: true, seed: true, groupIndex: true } });
    const tables = groupTables(t, participants, matches);
    const per = t.advancePerGroup ?? 1;
    const qualified = tables.map((g) => g.table.slice(0, per).map((s) => s.id));
    const seeds = knockoutSeeds(qualified);
    if (seeds.length < 2) throw new TournamentError("حداقل ۲ نفر باید به مرحلهٔ حذفی صعود کنند.");
    const specs = singleElimination(seeds, { thirdPlace: t.thirdPlaceMatch, keyPrefix: "K" });
    const max = matches.reduce((a, m) => Math.max(a, m.number), 0);
    await persistSpecs(tx, id, specs, max + 1);
    await tx.tournament.update({ where: { id }, data: { knockoutStarted: true } });
    await refreshCompletion(tx, id);
  });
}

function liveFrom(m: { id: string; player1Id: string | null; player2Id: string | null; player1Bye: boolean; player2Bye: boolean; status: string; winnerSlot: number | null; nextMatchId: string | null; nextSlot: number | null; loserMatchId: string | null; loserSlot: number | null }): LiveMatch {
  return {
    key: m.id,
    player1: m.player1Id,
    player2: m.player2Id,
    player1Bye: m.player1Bye,
    player2Bye: m.player2Bye,
    status: m.status as LiveMatch["status"],
    winnerSlot: (m.winnerSlot as 1 | 2 | null) ?? null,
    next: m.nextMatchId ? { key: m.nextMatchId, slot: m.nextSlot as 1 | 2 } : null,
    loser: m.loserMatchId ? { key: m.loserMatchId, slot: m.loserSlot as 1 | 2 } : null,
  };
}

type ScoreData = { score1: number | null; score2: number | null; note: string | null; setScores: string | null; forfeit: boolean };
const NO_SCORE: ScoreData = { score1: null, score2: null, note: null, setScores: null, forfeit: false };

async function writeLive(tx: Tx, live: Map<string, LiveMatch>, changed: string[], reportedId: string | null, scores: ScoreData | null) {
  for (const id of changed) {
    const l = live.get(id)!;
    const winnerId = l.status === "COMPLETED" && l.winnerSlot ? (l.winnerSlot === 1 ? l.player1 : l.player2) : null;
    await tx.tournamentMatch.update({
      where: { id },
      data: {
        player1Id: l.player1,
        player2Id: l.player2,
        player1Bye: l.player1Bye,
        player2Bye: l.player2Bye,
        status: l.status,
        winnerSlot: l.status === "PENDING" ? null : l.winnerSlot,
        winnerId,
        completedAt: l.status === "COMPLETED" ? new Date() : null,
        ...(l.status === "COMPLETED" ? { underwayAt: null } : {}),
        // Clear stale scores when a match goes back to pending or loses a player.
        ...(id === reportedId && scores ? scores : l.status === "PENDING" ? NO_SCORE : {}),
      },
    });
  }
}

const BRACKET_MESSAGES: Record<BracketError["code"], string> = {
  not_ready: "هنوز هر دو بازیکن این بازی مشخص نیستند.",
  downstream_played: "نتیجهٔ بازی‌های بعدی ثبت شده است. ابتدا آن نتیجه‌ها را پاک کنید.",
  not_found: "بازی پیدا نشد.",
  bye: "این بازی استراحت (بای) است و نتیجه ندارد.",
};

export interface ReportInput {
  score1: number;
  score2: number;
  winnerSlot?: 1 | 2;
  note: string;
  /** Game/set scores, already validated ("3-1,2-3"); score1/score2 are then the sets won. */
  setScores?: string | null;
  /** Win without playing; winnerSlot is required and no score is stored. */
  forfeit?: boolean;
}

type MatchRow = Awaited<ReturnType<Tx["tournamentMatch"]["findMany"]>>[number];

/** Applies one result inside a locked transaction (elimination results move players on). */
async function applyReport(tx: Tx, t: { knockoutStarted: boolean }, all: MatchRow[], m: MatchRow, input: ReportInput) {
  const note = input.note || null;
  const forfeit = !!input.forfeit;
  const scores: ScoreData = forfeit
    ? { score1: null, score2: null, note, setScores: null, forfeit: true }
    : { score1: input.score1, score2: input.score2, note, setScores: input.setScores ?? null, forfeit: false };
  if (forfeit && !input.winnerSlot) throw new TournamentError("برای برد فنی، برنده را انتخاب کنید.");
  if (!isEliminationStage(m.stage)) {
    if (m.stage === "GROUP" && t.knockoutStarted) throw new TournamentError("مرحلهٔ حذفی شروع شده و نتایج گروهی قفل است.");
    if (!m.player1Id || !m.player2Id) throw new TournamentError(BRACKET_MESSAGES.not_ready);
    const winnerSlot = forfeit ? input.winnerSlot! : input.score1 > input.score2 ? 1 : input.score1 < input.score2 ? 2 : null;
    await tx.tournamentMatch.update({
      where: { id: m.id },
      data: { ...scores, status: "COMPLETED", underwayAt: null, winnerSlot, winnerId: winnerSlot === 1 ? m.player1Id : winnerSlot === 2 ? m.player2Id : null, completedAt: new Date() },
    });
    return;
  }
  const winnerSlot: 1 | 2 | undefined = forfeit ? input.winnerSlot : input.score1 > input.score2 ? 1 : input.score1 < input.score2 ? 2 : input.winnerSlot;
  if (!winnerSlot) throw new TournamentError("در بازی حذفی مساوی، برنده را (مثلاً با پنالتی) مشخص کنید.");
  const live = new Map(all.map((x) => [x.id, liveFrom(x)]));
  const stage = new Map(all.map((x) => [x.id, x.stage as Stage]));
  let changed: string[];
  try {
    changed = applyResult(live, m.id, winnerSlot, (k) => stage.get(k)!);
  } catch (e) {
    if (e instanceof BracketError) throw new TournamentError(BRACKET_MESSAGES[e.code]);
    throw e;
  }
  await writeLive(tx, live, changed, m.id, scores);
}

/**
 * Disqualified players lose every match they reach without playing (Challonge: "remove participant"
 * during the tournament). Runs until no ready match involves a disqualified player.
 */
async function autoForfeit(tx: Tx, tournamentId: string) {
  const dq = new Set((await tx.tournamentParticipant.findMany({ where: { tournamentId, disqualifiedAt: { not: null } }, select: { id: true } })).map((p) => p.id));
  if (dq.size === 0) return;
  const t = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId }, select: { knockoutStarted: true } });
  for (let guard = 0; guard < 2000; guard++) {
    const all = await tx.tournamentMatch.findMany({ where: { tournamentId } });
    const m = all.find(
      (x) => x.status === "PENDING" && x.player1Id && x.player2Id && !(x.stage === "GROUP" && t.knockoutStarted) && (dq.has(x.player1Id) || dq.has(x.player2Id)),
    );
    if (!m) return;
    const winnerSlot: 1 | 2 = dq.has(m.player1Id!) && !dq.has(m.player2Id!) ? 2 : 1;
    await applyReport(tx, t, all, m, { score1: 0, score2: 0, winnerSlot, note: "حذف بازیکن", forfeit: true });
  }
}

export async function reportMatch(matchId: string, input: ReportInput) {
  return db.$transaction(async (tx) => {
    const match = await tx.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
    if (!match) throw new TournamentError("بازی پیدا نشد.");
    const t = await lockTournament(tx, match.tournamentId);
    if (t.status !== "IN_PROGRESS" && t.status !== "COMPLETED") throw new TournamentError("تورنومنت در حال برگزاری نیست.");
    const all = await tx.tournamentMatch.findMany({ where: { tournamentId: t.id } });
    const m = all.find((x) => x.id === matchId)!;
    await applyReport(tx, t, all, m, input);
    await autoForfeit(tx, t.id);
    await refreshCompletion(tx, t.id);
    return t;
  });
}

/** «در حال بازی» on/off for a match whose two players are known. */
export async function setMatchUnderway(matchId: string, on: boolean) {
  return db.$transaction(async (tx) => {
    const m = await tx.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!m) throw new TournamentError("بازی پیدا نشد.");
    await lockTournament(tx, m.tournamentId);
    if (m.status !== "PENDING" || !m.player1Id || !m.player2Id) throw new TournamentError("فقط بازی آمادهٔ انجام را می‌شود «در حال بازی» کرد.");
    await tx.tournamentMatch.update({ where: { id: m.id }, data: { underwayAt: on ? new Date() : null } });
    return m.tournamentId;
  });
}

/** Station (console/table) and planned time of a match. */
export async function setMatchDetails(matchId: string, details: { station: string | null; scheduledAt: Date | null }) {
  const m = await db.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
  if (!m) throw new TournamentError("بازی پیدا نشد.");
  await db.tournamentMatch.update({ where: { id: matchId }, data: details });
  return m.tournamentId;
}

/** Removes a player during the tournament: their pending matches are forfeited to the opponents. */
export async function disqualifyParticipant(participantId: string) {
  return db.$transaction(async (tx) => {
    const p = await tx.tournamentParticipant.findUnique({ where: { id: participantId } });
    if (!p) throw new TournamentError("شرکت‌کننده پیدا نشد.");
    const t = await lockTournament(tx, p.tournamentId);
    if (t.status !== "IN_PROGRESS") throw new TournamentError("حذف بازیکن وسط مسابقات فقط وقتی تورنومنت در حال برگزاری است ممکن است.");
    if (p.disqualifiedAt) throw new TournamentError("این بازیکن قبلاً حذف شده است.");
    await tx.tournamentParticipant.update({ where: { id: p.id }, data: { disqualifiedAt: new Date() } });
    await autoForfeit(tx, t.id);
    await refreshCompletion(tx, t.id);
    return t;
  });
}

/** Undoes a disqualification (results already forfeited stay; clear them by hand if needed). */
export async function reinstateParticipant(participantId: string) {
  const p = await db.tournamentParticipant.findUnique({ where: { id: participantId }, select: { tournamentId: true } });
  if (!p) throw new TournamentError("شرکت‌کننده پیدا نشد.");
  await db.tournamentParticipant.update({ where: { id: participantId }, data: { disqualifiedAt: null } });
  return p.tournamentId;
}

export async function clearMatch(matchId: string) {
  return db.$transaction(async (tx) => {
    const match = await tx.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
    if (!match) throw new TournamentError("بازی پیدا نشد.");
    const t = await lockTournament(tx, match.tournamentId);
    const all = await tx.tournamentMatch.findMany({ where: { tournamentId: t.id } });
    const m = all.find((x) => x.id === matchId)!;
    if (!isEliminationStage(m.stage)) {
      if (m.stage === "GROUP" && t.knockoutStarted) throw new TournamentError("مرحلهٔ حذفی شروع شده و نتایج گروهی قفل است.");
      await tx.tournamentMatch.update({ where: { id: m.id }, data: { ...NO_SCORE, status: "PENDING", winnerSlot: null, winnerId: null, completedAt: null } });
    } else {
      const live = new Map(all.map((x) => [x.id, liveFrom(x)]));
      const stage = new Map(all.map((x) => [x.id, x.stage as Stage]));
      try {
        const changed = clearResult(live, m.id, (k) => stage.get(k)!);
        await writeLive(tx, live, changed, m.id, NO_SCORE);
      } catch (e) {
        if (e instanceof BracketError) throw new TournamentError(BRACKET_MESSAGES[e.code]);
        throw e;
      }
    }
    await refreshCompletion(tx, t.id);
    return t;
  });
}

/**
 * Marks the tournament COMPLETED with final ranks when every match is decided (and, for group
 * tournaments, the knockout was played); reopens it if a result was cleared afterwards.
 */
async function refreshCompletion(tx: Tx, id: string) {
  const t = await tx.tournament.findUniqueOrThrow({ where: { id } });
  const matches = await tx.tournamentMatch.findMany({ where: { tournamentId: id } });
  const participants = await tx.tournamentParticipant.findMany({ where: { tournamentId: id }, select: { id: true, seed: true, groupIndex: true } });
  const done = matches.length > 0 && matches.every((m) => m.status !== "PENDING") && (t.format !== "GROUPS_KNOCKOUT" || t.knockoutStarted);
  if (!done) {
    if (t.status === "COMPLETED") {
      await tx.tournament.update({ where: { id }, data: { status: "IN_PROGRESS", completedAt: null } });
      await tx.tournamentParticipant.updateMany({ where: { tournamentId: id }, data: { finalRank: null } });
    }
    return;
  }
  const ranks = computeRanks(t, participants, matches);
  for (const [pid, rank] of ranks) await tx.tournamentParticipant.update({ where: { id: pid }, data: { finalRank: rank } });
  if (t.status !== "COMPLETED") await tx.tournament.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
}

type RankMatch = { stage: string; round: number; status: string; player1Id: string | null; player2Id: string | null; winnerSlot: number | null; groupIndex: number | null; score1: number | null; score2: number | null; forfeit?: boolean };

function computeRanks(
  t: { format: string; pointsWin: number; pointsDraw: number; pointsLoss: number },
  participants: { id: string; seed: number; groupIndex: number | null }[],
  matches: RankMatch[],
): Map<string, number> {
  const ranks = new Map<string, number>();
  const loserOf = (m: RankMatch) => (m.winnerSlot === 1 ? m.player2Id : m.winnerSlot === 2 ? m.player1Id : null);
  const winnerOf = (m: RankMatch) => (m.winnerSlot === 1 ? m.player1Id : m.winnerSlot === 2 ? m.player2Id : null);

  if (t.format === "ROUND_ROBIN") {
    const ids = [...participants].sort((a, b) => a.seed - b.seed).map((p) => p.id);
    const table = standings(ids, resultRows(matches), { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss });
    table.forEach((s, i) => ranks.set(s.id, i + 1));
    return ranks;
  }

  if (t.format === "DOUBLE_ELIMINATION") {
    const reset = matches.find((m) => m.stage === "GRAND_FINAL_RESET");
    const gf = matches.find((m) => m.stage === "GRAND_FINAL")!;
    const decider = reset && reset.status === "COMPLETED" ? reset : gf;
    const champion = winnerOf(decider);
    const runnerUp = loserOf(decider);
    if (champion) ranks.set(champion, 1);
    if (runnerUp) ranks.set(runnerUp, 2);
    // Others: eliminated in the losers bracket; later round = better rank.
    const elim = new Map<string, number>();
    for (const m of matches.filter((x) => x.stage === "LOSERS" && x.status === "COMPLETED")) {
      const l = loserOf(m);
      if (l) elim.set(l, m.round);
    }
    const sorted = [...elim.entries()].sort((a, b) => b[1] - a[1]);
    for (const [pid, round] of sorted) ranks.set(pid, 3 + sorted.filter(([, r]) => r > round).length);
    return ranks;
  }

  // Single elimination (or the knockout part of a group tournament).
  const ko = matches.filter((m) => m.stage === "WINNERS" || m.stage === "THIRD_PLACE");
  const totalRounds = Math.max(0, ...ko.filter((m) => m.stage === "WINNERS").map((m) => m.round));
  const final = ko.find((m) => m.stage === "WINNERS" && m.round === totalRounds);
  if (final) {
    const c = winnerOf(final);
    const r = loserOf(final);
    if (c) ranks.set(c, 1);
    if (r) ranks.set(r, 2);
  }
  const third = ko.find((m) => m.stage === "THIRD_PLACE" && m.status === "COMPLETED");
  if (third) {
    const w = winnerOf(third);
    const l = loserOf(third);
    if (w) ranks.set(w, 3);
    if (l) ranks.set(l, 4);
  }
  for (const m of ko.filter((x) => x.stage === "WINNERS" && x.round < totalRounds && x.status === "COMPLETED")) {
    const l = loserOf(m);
    if (!l || ranks.has(l)) continue;
    ranks.set(l, 2 ** (totalRounds - m.round) + 1);
  }
  if (t.format === "GROUPS_KNOCKOUT") {
    // Players who did not qualify: ranked after the knockout field by their group position.
    const base = ranks.size;
    const tables = groupTables(t, participants, matches);
    const remaining = tables.flatMap((g) => g.table.map((s, pos) => ({ id: s.id, pos, pts: s.points, gd: s.goalDiff }))).filter((x) => !ranks.has(x.id));
    remaining.sort((a, b) => a.pos - b.pos || b.pts - a.pts || b.gd - a.gd);
    // Same group position → shared rank (e.g. all third-placed players share the next rank).
    for (const x of remaining) ranks.set(x.id, base + 1 + remaining.filter((y) => y.pos < x.pos).length);
  }
  return ranks;
}
