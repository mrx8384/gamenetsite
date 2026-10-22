import { connection } from "next/server";
import { db } from "@/lib/db";

/** Liveness + database check for hosting monitors. Reveals no internal details. */
export async function GET() {
  await connection(); // always evaluate at request time
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[health] database check failed", error);
    return Response.json({ status: "error", db: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
