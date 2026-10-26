import { createRoom } from "@/atom-world/server/rooms";
import { allow, clientIp, errorStatus, json, readJson, sameOrigin } from "@/atom-world/server/http";

/** GET: is online play available here? POST { game, name } → { code, token } (a new room, seat 0). */
export function GET() {
  return json({ version: 1, online: true });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  // a visitor rarely needs more than a few rooms a minute
  if (!allow(`create:${clientIp(req)}`, 10)) return json({ error: "rate" }, 429);
  const body = await readJson(req);
  if (!body) return json({ error: "bad-request" }, 400);
  const r = createRoom(body.game, body.name);
  return "error" in r ? json(r, errorStatus(r.error)) : json(r);
}
