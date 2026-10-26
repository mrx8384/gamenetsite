import { isAdmin } from "@/atom-world/server/adminAuth";
import { json, sameOrigin } from "@/atom-world/server/http";
import { MAX_UPLOAD, saveUpload } from "@/atom-world/server/worldStore";

/** POST <image bytes> (PNG / JPEG / WebP, ≤ 4 MB) → { url } for wall art or machine photos. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!(await isAdmin(req))) return json({ error: "login" }, 401);
  if (Number(req.headers.get("content-length") ?? "0") > MAX_UPLOAD) return json({ error: "size" }, 413);
  const bytes = new Uint8Array(await req.arrayBuffer());
  const r = await saveUpload(bytes);
  return "error" in r ? json(r, r.error === "size" ? 413 : 415) : json(r);
}
