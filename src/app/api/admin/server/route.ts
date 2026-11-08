import { connection } from "next/server";
import { getSession } from "@/lib/auth/dal";
import { getLiveSnapshot } from "@/features/server-status/collect";
import { getHistory, getServerDetails } from "@/features/server-status/queries";
import { isHistoryRange } from "@/features/server-status/ranges";

/** Admin → وضعیت سرور: ?part=live (polled every few seconds) | details | history&range=24h. ADMIN only. */
export async function GET(req: Request) {
  await connection();
  if ((await getSession())?.user.role !== "ADMIN") return Response.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const part = url.searchParams.get("part");
  const headers = { "Cache-Control": "private, no-store" };
  if (part === "live") return Response.json(await getLiveSnapshot(), { headers });
  if (part === "details") return Response.json(await getServerDetails(), { headers });
  if (part === "history") {
    const range = url.searchParams.get("range");
    if (!isHistoryRange(range)) return Response.json({ error: "bad range" }, { status: 400 });
    return Response.json(await getHistory(range), { headers });
  }
  return Response.json({ error: "bad request" }, { status: 400 });
}
