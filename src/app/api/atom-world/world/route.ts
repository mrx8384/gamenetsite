import { connection } from "next/server";
import { readConfig } from "@/atom-world/server/worldStore";

/** GET: the manager's world config (item places, wall art, texts, machine info). Public, read-only. */
export async function GET() {
  // read at request time, never prerendered (the site builds with Cache Components)
  await connection();
  const cfg = await readConfig();
  // always revalidated: a save in the editor shows up on the next visit
  return Response.json(cfg, { headers: { "cache-control": "no-cache", "x-content-type-options": "nosniff" } });
}
