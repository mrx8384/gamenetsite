import { connection } from "next/server";
import { platformFromSlug } from "@/features/game-catalog/constants";
import { getCatalogVersion } from "@/features/game-catalog/queries";

/** Tiny change marker polled by the public catalog page for live refresh (replaces the original 3 s polling). */
export async function GET(request: Request) {
  await connection();
  const platform = platformFromSlug(new URL(request.url).searchParams.get("p") ?? "");
  if (!platform) return Response.json({ error: "invalid platform" }, { status: 400 });
  const version = await getCatalogVersion(platform);
  return Response.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
