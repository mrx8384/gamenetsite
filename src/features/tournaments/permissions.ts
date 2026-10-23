import "server-only";
import { db } from "@/lib/db";
import { hasEntitlement } from "@/features/subscriptions/entitlements";

type Actor = { id: string; role: "ADMIN" | "USER" | "PARTNER" };

/** Admins always; partners only when their subscription includes TOURNAMENT_HOST. */
export async function canCreateTournament(user: Actor | null): Promise<boolean> {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.role === "PARTNER" && (await hasEntitlement(user.id, "TOURNAMENT_HOST"));
}

/** Admins manage every tournament; a partner manages the tournaments they organize (while approved). */
export function canManageTournament(user: Actor | null, t: { organizerId: string | null }): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.role === "PARTNER" && t.organizerId === user.id;
}

/** Loads a tournament the actor may manage, or null. */
export async function manageableTournament(user: Actor | null, id: string) {
  if (!user || typeof id !== "string") return null;
  const t = await db.tournament.findUnique({ where: { id } });
  return t && canManageTournament(user, t) ? t : null;
}
