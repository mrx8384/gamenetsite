import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * One-time round tokens: the server notes when a mini-game round starts, so a finished round can be
 * timed by the server (not by the browser) and reported only once. Stateless (HMAC with AUTH_SECRET);
 * "used once" is enforced by the caller with a rate-limit bucket on the token's nonce.
 */
const sign = (payload: string) => createHmac("sha256", `game-round:${env.AUTH_SECRET}`).update(payload).digest("base64url");

export function createRoundToken(userId: string, game: string, now = Date.now()) {
  const nonce = randomBytes(12).toString("base64url");
  return `${now}.${nonce}.${sign(`${userId}.${game}.${now}.${nonce}`)}`;
}

/** → { startedAt, nonce } when the token was made for this user and game; null otherwise. */
export function readRoundToken(token: string, userId: string, game: string): { startedAt: number; nonce: string } | null {
  const [at, nonce, sig] = token.split(".");
  const startedAt = Number(at);
  if (!Number.isSafeInteger(startedAt) || !nonce || !sig) return null;
  const want = Buffer.from(sign(`${userId}.${game}.${startedAt}.${nonce}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  return { startedAt, nonce };
}
