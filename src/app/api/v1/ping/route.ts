import type { NextRequest } from "next/server";
import { apiOk, authenticate } from "@/features/api/auth";
import { db } from "@/lib/db";

/** Checks the key. Works with any key that has booking:read. */
export async function GET(request: NextRequest) {
  const auth = await authenticate(request, "booking:read");
  if (auth instanceof Response) return auth;
  const key = await db.apiKey.findUnique({ where: { id: auth.keyId }, select: { name: true, scopes: true } });
  return apiOk({ ok: true, key: key?.name, scopes: key?.scopes, time: new Date().toISOString() });
}
