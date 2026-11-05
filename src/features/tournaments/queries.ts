import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { readAnswers, readSignupQuestions } from "./schemas";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { GRAND_FINAL_MODES, TIEBREAKS, TournamentFormatKey, TournamentStatusKey } from "./constants";

const include = {
  organizer: { select: { role: true, name: true, partnerProfile: { select: { businessName: true } } } },
  participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, seed: true, groupIndex: true, finalRank: true, userId: true, checkedInAt: true, disqualifiedAt: true, members: true } },
  matches: {
    orderBy: { number: "asc" },
    select: { id: true, stage: true, round: true, position: true, groupIndex: true, number: true, player1Id: true, player2Id: true, player1Bye: true, player2Bye: true, score1: true, score2: true, winnerSlot: true, status: true, note: true, setScores: true, forfeit: true, underwayAt: true, station: true, scheduledAt: true, nextMatchId: true, nextSlot: true, claimBySlot: true, claimScore1: true, claimScore2: true, claimWinnerSlot: true, claimSetScores: true, claimNote: true, claimAt: true },
  },
  points: { select: { participantId: true, round: true, points: true } },
  _count: { select: { waitlist: true } },
} satisfies Prisma.TournamentInclude;

type Row = Prisma.TournamentGetPayload<{ include: typeof include }>;

export interface TournamentView {
  id: string;
  slug: string;
  name: string;
  game: string;
  platform: string | null;
  description: string | null;
  rules: string | null;
  prize: string | null;
  entryFeeNote: string | null;
  /** Online registration fee in Rials, as a string (0 = free). */
  entryFee: string;
  startsAt: string | null;
  format: TournamentFormatKey;
  status: TournamentStatusKey;
  maxParticipants: number | null;
  allowSelfRegistration: boolean;
  thirdPlaceMatch: boolean;
  doubleRoundRobin: boolean;
  groupCount: number | null;
  advancePerGroup: number | null;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  knockoutStarted: boolean;
  grandFinal: (typeof GRAND_FINAL_MODES)[number];
  tiebreak: (typeof TIEBREAKS)[number];
  /** Swiss: planned rounds (null = automatic). */
  swissRounds: number | null;
  /** Leaderboard: number of round columns. */
  leaderboardRounds: number | null;
  /** Leaderboard points per participant and round. */
  points: Row["points"];
  teamSize: number | null;
  signupQuestions: { label: string; required: boolean }[];
  allowPlayerReports: boolean;
  allowPredictions: boolean;
  waitlistEnabled: boolean;
  waitlistCount: number;
  /** Check-in opens this many minutes before the start (null = no check-in). */
  checkInMinutes: number | null;
  organizerId: string | null;
  organizerName: string;
  participants: Row["participants"];
  matches: Row["matches"];
}

function toView(t: Row): TournamentView {
  const organizerName = t.organizer?.role === "PARTNER" ? (t.organizer.partnerProfile?.businessName ?? t.organizer.name) : "اتم گیم کلاب";
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    game: t.game,
    platform: t.platform,
    description: t.description,
    rules: t.rules,
    prize: t.prize,
    entryFeeNote: t.entryFeeNote,
    entryFee: t.entryFee.toString(),
    startsAt: t.startsAt?.toISOString() ?? null,
    format: t.format,
    status: t.status,
    maxParticipants: t.maxParticipants,
    allowSelfRegistration: t.allowSelfRegistration,
    thirdPlaceMatch: t.thirdPlaceMatch,
    doubleRoundRobin: t.doubleRoundRobin,
    groupCount: t.groupCount,
    advancePerGroup: t.advancePerGroup,
    pointsWin: t.pointsWin,
    pointsDraw: t.pointsDraw,
    pointsLoss: t.pointsLoss,
    knockoutStarted: t.knockoutStarted,
    grandFinal: (t.grandFinal === "single" || t.grandFinal === "none" ? t.grandFinal : "reset"),
    tiebreak: t.tiebreak === "head_to_head" ? "head_to_head" : "goal_difference",
    swissRounds: t.swissRounds,
    leaderboardRounds: t.leaderboardRounds,
    points: t.points,
    teamSize: t.teamSize,
    signupQuestions: readSignupQuestions(t.signupQuestions),
    allowPlayerReports: t.allowPlayerReports,
    allowPredictions: t.allowPredictions,
    waitlistEnabled: t.waitlistEnabled,
    waitlistCount: t._count.waitlist,
    checkInMinutes: t.checkInMinutes,
    organizerId: t.organizerId,
    organizerName,
    participants: t.participants,
    matches: t.matches,
  };
}

const PUBLIC_STATUSES = ["REGISTRATION", "IN_PROGRESS", "COMPLETED"] as const;

export interface TournamentCard {
  id: string;
  slug: string;
  name: string;
  game: string;
  platform: string | null;
  format: TournamentFormatKey;
  status: TournamentStatusKey;
  startsAt: string | null;
  participantCount: number;
  maxParticipants: number | null;
  organizerName: string;
  prize: string | null;
}

/** Public list (published tournaments only). */
export async function getPublicTournaments(): Promise<TournamentCard[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.tournaments);
  const rows = await db.tournament.findMany({
    where: { status: { in: [...PUBLIC_STATUSES] } },
    orderBy: [{ startsAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
    include: { organizer: include.organizer, _count: { select: { participants: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    game: t.game,
    platform: t.platform,
    format: t.format,
    status: t.status,
    startsAt: t.startsAt?.toISOString() ?? null,
    participantCount: t._count.participants,
    maxParticipants: t.maxParticipants,
    organizerName: t.organizer?.role === "PARTNER" ? (t.organizer.partnerProfile?.businessName ?? t.organizer.name) : "اتم گیم کلاب",
    prize: t.prize,
  }));
}

/** Public tournament page data (drafts are hidden). */
export async function getPublicTournament(slug: string): Promise<TournamentView | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.tournaments);
  const t = await db.tournament.findFirst({ where: { slug, status: { in: [...PUBLIC_STATUSES, "CANCELLED"] } }, include });
  return t ? toView(t) : null;
}

/** Organizer view (not cached; permission is checked by the caller). */
export async function getTournamentForManage(id: string): Promise<TournamentView | null> {
  const t = await db.tournament.findUnique({ where: { id }, include });
  return t ? toView(t) : null;
}

/** Organizer-only extras: sign-up answers, waiting list, co-organizers (never in the public view). */
export async function getTournamentPrivate(id: string) {
  const [answers, waitlist, coOrganizers] = await Promise.all([
    db.tournamentParticipant.findMany({ where: { tournamentId: id, answers: { not: Prisma.DbNull } }, select: { id: true, answers: true } }),
    db.tournamentWaitlist.findMany({ where: { tournamentId: id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, members: true, answers: true, createdAt: true } }),
    db.tournamentCoOrganizer.findMany({ where: { tournamentId: id }, orderBy: { createdAt: "asc" }, select: { userId: true, user: { select: { name: true, email: true, phone: true } } } }),
  ]);
  return {
    answers: Object.fromEntries(answers.map((a) => [a.id, readAnswers(a.answers)])) as Record<string, { q: string; a: string }[]>,
    waitlist: waitlist.map((w) => ({ id: w.id, name: w.name, members: w.members, answers: readAnswers(w.answers), createdAt: w.createdAt.toISOString() })),
    coOrganizers: coOrganizers.map((c) => ({ userId: c.userId, name: c.user.name, contact: c.user.email ?? c.user.phone ?? "" })),
  };
}

export type TournamentPrivate = Awaited<ReturnType<typeof getTournamentPrivate>>;

/** Tournaments the user helps organize (co-organizer). */
export async function getCoOrganizedTournaments(userId: string) {
  return db.tournament.findMany({
    where: { coOrganizers: { some: { userId } } },
    orderBy: { createdAt: "desc" },
    include: { organizer: include.organizer, _count: { select: { participants: true } } },
  });
}

/** Tournaments an organizer can manage: all for admins, own for partners. */
export async function getManagedTournaments(user: { id: string; role: string }) {
  return db.tournament.findMany({
    where: user.role === "ADMIN" ? {} : { organizerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { organizer: include.organizer, _count: { select: { participants: true } } },
  });
}
