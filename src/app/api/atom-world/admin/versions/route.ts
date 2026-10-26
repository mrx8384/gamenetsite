import { isAdmin } from "@/atom-world/server/adminAuth";
import { json, readJson, sameOrigin } from "@/atom-world/server/http";
import { listVersions, restoreVersion } from "@/atom-world/server/worldStore";

/** GET → earlier saved versions (newest first). */
export async function GET(req: Request) {
  if (!(await isAdmin(req))) return json({ error: "login" }, 401);
  return json({ versions: await listVersions() });
}

/** POST { id } → puts that version back. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!(await isAdmin(req))) return json({ error: "login" }, 401);
  const body = await readJson(req, 1024);
  const cfg = typeof body?.id === "string" ? await restoreVersion(body.id) : null;
  return cfg ? json(cfg) : json({ error: "not-found" }, 404);
}
