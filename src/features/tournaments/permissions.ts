import "server-only";
import { db } from "@/lib/db";
import { hasEntitlement } from "@/features/subscriptions/entitlements";

type Actor = { id: string; role: "ADMIN" | "USER" | "PARTNER" | "SUPPORT" };

/**
 * "owner": admins and the organizing partner — everything.
 * "co": co-organizers added by the owner — results, participants, check-in, start/reset, exports;
 * not the settings, publishing/cancelling, deleting or the co-organizer list.
 */
export type ManageRole = "owner" | "co";

/** Admins always; partners only when their subscription includes TOURNAMENT_HOST. */
export async function canCreateTournament(user: Actor | null): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.role === "PARTNER" && (await hasEntitlement(user.id, "TOURNAMENT_HOST"));
}

/** Owner rights: admins on every tournament; a partner on the tournaments they organize. */
export function isTournamentOwner(user: Actor | null, t: { organizerId: string | null }): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.role === "PARTNER" && t.organizerId === user.id;
}

export async function tournamentRole(user: Actor | null, t: { id: string; organizerId: string | null }): Promise<ManageRole | null> {
  if (!user) return null;
  if (isTournamentOwner(user, t)) return "owner";
  const co = await db.tournamentCoOrganizer.findUnique({ where: { tournamentId_userId: { tournamentId: t.id, userId: user.id } }, select: { userId: true } });
  return co ? "co" : null;
}

/** Loads a tournament the actor may manage (with the needed level), or null. */
export async function manageableTournament(user: Actor | null, id: string, need: ManageRole = "co") {
  if (!user || typeof id !== "string") return null;
  const t = await db.tournament.findUnique({ where: { id } });
  if (!t) return null;
  const role = await tournamentRole(user, t);
  if (!role || (need === "owner" && role !== "owner")) return null;
  return Object.assign(t, { role });
}
