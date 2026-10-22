import "server-only";
import { db } from "@/lib/db";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter stored in PostgreSQL (atomic upsert; works across server processes).
 * @param key      e.g. "login:ip:1.2.3.4"
 * @param limit    max hits per window
 * @param windowSeconds window length
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO rate_limit_buckets ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN rate_limit_buckets."resetAt" <= now() THEN 1 ELSE rate_limit_buckets."count" + 1 END,
      "resetAt" = CASE WHEN rate_limit_buckets."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE rate_limit_buckets."resetAt" END
    RETURNING "count", "resetAt"`;
  const { count, resetAt } = rows[0];
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(0, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Clears a bucket, e.g. after a successful login. */
export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimitBucket.deleteMany({ where: { key } });
}

/** Housekeeping: remove expired buckets (call from a periodic job). */
export async function purgeExpiredRateLimits(): Promise<number> {
  const { count } = await db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
  return count;
}
