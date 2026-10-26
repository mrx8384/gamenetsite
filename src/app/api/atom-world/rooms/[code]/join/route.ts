import { joinRoom } from "@/atom-world/server/rooms";
import { allow, clientIp, errorStatus, json, readJson, sameOrigin, validCode } from "@/atom-world/server/http";

/** POST { name } → { token, game, hostName } (seat 1). */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  // slows down guessing codes of strangers' rooms
  if (!allow(`join:${clientIp(req)}`, 20)) return json({ error: "rate" }, 429);
  if (!validCode(code)) return json({ error: "not-found" }, 404);
  const body = await readJson(req);
  if (!body) return json({ error: "bad-request" }, 400);
  const r = joinRoom(code, body.name);
  return "error" in r ? json(r, errorStatus(r.error)) : json(r);
}
