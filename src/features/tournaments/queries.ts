import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { TournamentFormatKey, TournamentStatusKey } from "./constants";

const include = {
  organizer: { select: { role: true, name: true, partnerProfile: { select: { businessName: true } } } },
  participants: { orderBy: [{ seed: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, seed: true, groupIndex: true, finalRank: true, userId: true } },
  matches: {
    orderBy: { number: "asc" },
    select: { id: true, stage: true, round: true, position: true, groupIndex: true, number: true, player1Id: true, player2Id: true, player1Bye: true, player2Bye: true, score1: true, score2: true, winnerSlot: true, status: true, note: true },
  },
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
  organizerId: string | null;
  organizerName: string;
  participants: Row["participants"];
  matches: Row["matches"];
}

function toView(t: Row): TournamentView {
  const organizerName = t.organizer?.role === "PARTNER" ? (t.organizer.partnerProfile?.businessName ?? t.organizer.name) : "آتم گیم کلاب";
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
    organizerName: t.organizer?.role === "PARTNER" ? (t.organizer.partnerProfile?.businessName ?? t.organizer.name) : "آتم گیم کلاب",
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

/** Tournaments an organizer can manage: all for admins, own for partners. */
export async function getManagedTournaments(user: { id: string; role: string }) {
  return db.tournament.findMany({
    where: user.role === "ADMIN" ? {} : { organizerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { organizer: include.organizer, _count: { select: { participants: true } } },
  });
}
