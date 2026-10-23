import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { isEliminationStage } from "./constants";
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
  });
}

/** Back to registration: removes all matches and results (participants are kept). */
export async function resetTournament(id: string) {
  await db.$transaction(async (tx) => {
    await lockTournament(tx, id);
    await tx.tournamentMatch.deleteMany({ where: { tournamentId: id } });
    await tx.tournamentParticipant.updateMany({ where: { tournamentId: id }, data: { groupIndex: null, finalRank: null } });
    await tx.tournament.update({ where: { id }, data: { status: "REGISTRATION", startedAt: null, completedAt: null, knockoutStarted: false } });
  });
}

function groupTables(t: { pointsWin: number; pointsDraw: number; pointsLoss: number }, participants: { id: string; seed: number; groupIndex: number | null }[], matches: { stage: string; groupIndex: number | null; status: string; player1Id: string | null; player2Id: string | null; score1: number | null; score2: number | null }[]) {
  const groups = new Map<number, string[]>();
  for (const p of [...participants].sort((a, b) => a.seed - b.seed)) {
    if (p.groupIndex === null) continue;
    groups.set(p.groupIndex, [...(groups.get(p.groupIndex) ?? []), p.id]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([gi, members]) => ({
    groupIndex: gi,
    table: standings(
      members,
      matches
        .filter((m) => m.stage === "GROUP" && m.groupIndex === gi && m.status === "COMPLETED" && m.player1Id && m.player2Id && m.score1 !== null && m.score2 !== null)
        .map((m) => ({ player1: m.player1Id!, player2: m.player2Id!, score1: m.score1!, score2: m.score2! })),
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

async function writeLive(tx: Tx, live: Map<string, LiveMatch>, changed: string[], reportedId: string | null, scores: { score1: number | null; score2: number | null; note: string | null } | null) {
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
        // Clear stale scores when a match goes back to pending or loses a player.
        ...(id === reportedId && scores ? scores : l.status === "PENDING" ? { score1: null, score2: null, note: null } : {}),
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

export async function reportMatch(matchId: string, input: { score1: number; score2: number; winnerSlot?: 1 | 2; note: string }) {
  return db.$transaction(async (tx) => {
    const match = await tx.tournamentMatch.findUnique({ where: { id: matchId }, select: { tournamentId: true } });
    if (!match) throw new TournamentError("بازی پیدا نشد.");
    const t = await lockTournament(tx, match.tournamentId);
    if (t.status !== "IN_PROGRESS" && t.status !== "COMPLETED") throw new TournamentError("تورنومنت در حال برگزاری نیست.");
    const all = await tx.tournamentMatch.findMany({ where: { tournamentId: t.id } });
    const m = all.find((x) => x.id === matchId)!;
    const note = input.note || null;

    if (!isEliminationStage(m.stage)) {
      if (m.stage === "GROUP" && t.knockoutStarted) throw new TournamentError("مرحلهٔ حذفی شروع شده و نتایج گروهی قفل است.");
      if (!m.player1Id || !m.player2Id) throw new TournamentError(BRACKET_MESSAGES.not_ready);
      const winnerSlot = input.score1 > input.score2 ? 1 : input.score1 < input.score2 ? 2 : null;
      await tx.tournamentMatch.update({
        where: { id: m.id },
        data: { score1: input.score1, score2: input.score2, note, status: "COMPLETED", winnerSlot, winnerId: winnerSlot === 1 ? m.player1Id : winnerSlot === 2 ? m.player2Id : null, completedAt: new Date() },
      });
    } else {
      const winnerSlot: 1 | 2 | undefined = input.score1 > input.score2 ? 1 : input.score1 < input.score2 ? 2 : input.winnerSlot;
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
      await writeLive(tx, live, changed, m.id, { score1: input.score1, score2: input.score2, note });
    }
    await refreshCompletion(tx, t.id);
    return t;
  });
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
      await tx.tournamentMatch.update({ where: { id: m.id }, data: { score1: null, score2: null, note: null, status: "PENDING", winnerSlot: null, winnerId: null, completedAt: null } });
    } else {
      const live = new Map(all.map((x) => [x.id, liveFrom(x)]));
      const stage = new Map(all.map((x) => [x.id, x.stage as Stage]));
      try {
        const changed = clearResult(live, m.id, (k) => stage.get(k)!);
        await writeLive(tx, live, changed, m.id, { score1: null, score2: null, note: null });
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

type RankMatch = { stage: string; round: number; status: string; player1Id: string | null; player2Id: string | null; winnerSlot: number | null; groupIndex: number | null; score1: number | null; score2: number | null };

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
    const table = standings(ids, matches.filter((m) => m.status === "COMPLETED" && m.player1Id && m.player2Id && m.score1 !== null && m.score2 !== null).map((m) => ({ player1: m.player1Id!, player2: m.player2Id!, score1: m.score1!, score2: m.score2! })), { win: t.pointsWin, draw: t.pointsDraw, loss: t.pointsLoss });
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
