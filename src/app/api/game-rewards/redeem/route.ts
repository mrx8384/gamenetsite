import { json, readJson, sameOrigin } from "@/atom-world/server/http";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/rate-limit";
import { redeemCard, RewardError } from "@/features/game-rewards/service";

/** POST { cardId } → spends points, returns the new card (with its code) and the balance. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "login" }, 401);
  if (!(await rateLimit(`game-redeem:${user.id}`, 10, 60 * 60)).allowed) return json({ error: "rate" }, 429);
  const body = await readJson(req, 1024);
  const cardId = typeof body?.cardId === "string" ? body.cardId.slice(0, 40) : "";
  if (!cardId) return json({ error: "bad-request" }, 400);
  try {
    const r = await redeemCard(user.id, cardId);
    await audit({ actorId: user.id, action: "rewards.redeemed", entity: "reward_redemption", entityId: r.card.code, meta: { cardId } });
    return json(r);
  } catch (e) {
    if (e instanceof RewardError) return json({ error: e.code === "inactive" || e.code === "points" || e.code === "limit" ? e.code : "error" }, 409);
    throw e;
  }
}
