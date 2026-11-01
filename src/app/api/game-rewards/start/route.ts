import { z } from "zod";
import { json, readJson, sameOrigin } from "@/atom-world/server/http";
import { PLAYABLE_GAMES } from "@/atom-world/minigames/achievementList";
import type { MiniGameId } from "@/atom-world/data/machineData";
import { getCurrentUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/rate-limit";
import { createRoundToken } from "@/features/game-rewards/round-token";

const schema = z.object({ game: z.enum(PLAYABLE_GAMES as [MiniGameId, ...MiniGameId[]]) });

/** POST { game } when a mini-game round starts → { token } to send with the finished round. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "login" }, 401);
  if (!(await rateLimit(`game-start:${user.id}`, 30, 60)).allowed) return json({ error: "rate" }, 429);
  const parsed = schema.safeParse(await readJson(req, 1024));
  if (!parsed.success) return json({ error: "bad-request" }, 400);
  return json({ token: createRoundToken(user.id, parsed.data.game) });
}
