import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { validateSession, type SessionUser, type ValidSession } from "./session";

/**
 * Data Access Layer: the only place pages and actions read the current user.
 * Reads cookies → callers must render inside <Suspense> (Cache Components).
 */
export const getSession = cache(async (): Promise<ValidSession | null> => validateSession());

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** For pages: redirects anonymous visitors to the login page. */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** For admin pages: anonymous → login; logged in without the role → 404 (doesn't reveal the area). */
export async function requireRole(roles: SessionUser["role"][], returnTo: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!roles.includes(user.role)) notFound();
  return user;
}

export class AuthorizationError extends Error {
  constructor(public readonly reason: "unauthenticated" | "forbidden") {
    super(reason);
  }
}

/** For server actions: throws instead of redirecting. */
export async function assertUser(): Promise<ValidSession> {
  const session = await getSession();
  if (!session) throw new AuthorizationError("unauthenticated");
  return session;
}

export async function assertRole(roles: SessionUser["role"][]): Promise<ValidSession> {
  const session = await assertUser();
  if (!roles.includes(session.user.role)) throw new AuthorizationError("forbidden");
  return session;
}
