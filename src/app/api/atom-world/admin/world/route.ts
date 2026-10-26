import { isAdmin } from "@/atom-world/server/adminAuth";
import { json, readJson, sameOrigin } from "@/atom-world/server/http";
import { saveConfig } from "@/atom-world/server/worldStore";
import { LIMITS } from "@/atom-world/world/config";

/** PUT <world config> → validated, saved (the previous one is kept as a version), returned. */
export async function PUT(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!(await isAdmin(req))) return json({ error: "login" }, 401);
  const body = await readJson(req, LIMITS.bytes);
  if (!body) return json({ error: "bad-request" }, 400);
  return json(await saveConfig(body));
}
