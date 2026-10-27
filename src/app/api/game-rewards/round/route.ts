import { json, readJson, sameOrigin } from "@/atom-world/server/http";
import { getCurrentUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/rate-limit";
import { roundInputSchema } from "@/features/game-rewards/rules";
import { recordRound } from "@/features/game-rewards/service";

/** POST { game, stats, seconds } after a finished mini-game round → points and new achievements. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "login" }, 401);
  if (!(await rateLimit(`game-round:${user.id}`, 20, 60)).allowed) return json({ error: "rate" }, 429);
  const parsed = roundInputSchema.safeParse(await readJson(req, 4096));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  const r = await recordRound(user.id, parsed.data);
  return json({ roundPoints: r.roundPoints, achievements: r.achievements, capReached: r.capReached, balance: r.balance });
}
