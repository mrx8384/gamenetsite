import { send } from "@/atom-world/server/rooms";
import { errorStatus, json, readJson, sameOrigin, validCode } from "@/atom-world/server/http";

/** POST { token, msgs: [...] } → passes the messages to the other player. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!validCode(code)) return json({ error: "not-found" }, 404);
  const body = await readJson(req);
  if (!body) return json({ error: "bad-request" }, 400);
  const r = send(code, body.token, body.msgs);
  return "error" in r ? json(r, errorStatus(r.error)) : json(r);
}
