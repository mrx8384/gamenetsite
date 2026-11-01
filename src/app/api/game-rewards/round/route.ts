import { json, readJson, sameOrigin } from "@/atom-world/server/http";
import type { Stats } from "@/atom-world/minigames/achievementList";
import { getCurrentUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_ROUND_SECONDS, plausibleRound, roundInputSchema } from "@/features/game-rewards/rules";
import { readRoundToken } from "@/features/game-rewards/round-token";
import { recordRound } from "@/features/game-rewards/service";

/**
 * POST { token, game, stats, seconds } after a finished mini-game round → points and new achievements.
 * The round must have been started on the server (token from /start, used once), timed by the server,
 * and its numbers must be possible in that time; otherwise nothing is counted.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "login" }, 401);
  if (!(await rateLimit(`game-round:${user.id}`, 20, 60)).allowed) return json({ error: "rate" }, 429);
  const parsed = roundInputSchema.safeParse(await readJson(req, 4096));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  const round = readRoundToken(parsed.data.token, user.id, parsed.data.game);
  if (!round) return json({ error: "token" }, 400);
  const elapsed = (Date.now() - round.startedAt) / 1000;
  if (elapsed > MAX_ROUND_SECONDS) return json({ error: "token" }, 400);
  if (!plausibleRound(parsed.data.game, parsed.data.stats as Stats, elapsed)) return json({ error: "implausible" }, 422);
  // each round counts once
  if (!(await rateLimit(`game-round-token:${round.nonce}`, 1, MAX_ROUND_SECONDS)).allowed) return json({ error: "used" }, 409);
  const r = await recordRound(user.id, parsed.data);
  return json({ roundPoints: r.roundPoints, achievements: r.achievements, capReached: r.capReached, balance: r.balance });
}
