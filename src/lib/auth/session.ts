import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { mergeGuestCartIntoUser } from "@/features/cart/service";
import { generateToken, sha256Hex } from "./crypto";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOUCH_INTERVAL_MS = 60 * 60 * 1000; // update lastSeenAt at most hourly

const secureCookies = env.APP_URL.startsWith("https://");
/** `__Host-` prefix forces Secure, Path=/ and no Domain (only possible over HTTPS). */
export const SESSION_COOKIE = secureCookies ? "__Host-atom_session" : "atom_session";

/** Mirrors the Prisma `Role` enum. SUPPORT may only use the support inbox in the admin panel. */
export type UserRole = "ADMIN" | "USER" | "PARTNER" | "SUPPORT";

export interface SessionUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
}

export interface ValidSession {
  sessionId: string;
  user: SessionUser;
}

/** Creates a DB session and sets the cookie. Call only from Server Actions / Route Handlers. */
export async function createSession(userId: string, meta: { ip?: string; userAgent?: string | null }): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.$transaction([
    db.session.create({
      data: { tokenHash: sha256Hex(token), userId, expiresAt, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null },
    }),
    db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  // Keep what a guest added to the cart before logging in.
  await mergeGuestCartIntoUser(userId).catch((e) => console.error("[cart] merge failed", e));
}

/** Reads and validates the session cookie. Returns null for missing/expired/revoked sessions or inactive users. */
export async function validateSession(): Promise<ValidSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: { select: { id: true, name: true, email: true, phone: true, role: true, isActive: true } },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.isActive) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => {});
  }

  const { id, name, email, phone, role } = session.user;
  return { sessionId: session.id, user: { id, name, email, phone, role } };
}

/** Logs out the current device. */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
  store.delete(SESSION_COOKIE);
}

/** Revokes all sessions of a user (optionally keeping one). */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<number> {
  const { count } = await db.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
  return count;
}

export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
