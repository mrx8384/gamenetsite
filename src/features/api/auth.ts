import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateToken, sha256Hex } from "@/lib/auth/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { API_KEY_PREFIX, API_RATE_PER_MINUTE, type ApiScope } from "./scopes";

/** New key: shown once to the admin; only its SHA-256 is stored. */
export function newApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${API_KEY_PREFIX}${generateToken(24)}`;
  return { key, prefix: key.slice(0, 12), hash: sha256Hex(key) };
}

export function apiError(status: number, code: string, message: string, headers?: Record<string, string>) {
  return NextResponse.json({ success: false, code, message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function apiOk(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

/** BigInt-safe JSON values (money in Rials and Toman as strings/numbers). */
export const money = (rial: bigint) => ({ rial: rial.toString(), toman: Number(rial / BigInt(10)) });

/**
 * Checks `Authorization: Bearer atm_…`, the key's scope and the per-key rate limit.
 * Returns the key id or an error response.
 */
export async function authenticate(request: NextRequest, scope: ApiScope): Promise<{ keyId: string } | NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(header);
  if (!m || !m[1].startsWith(API_KEY_PREFIX) || m[1].length > 100) return apiError(401, "unauthorized", "کلید API ارسال نشده یا نامعتبر است.");
  const key = await db.apiKey.findUnique({ where: { hash: sha256Hex(m[1]) }, select: { id: true, scopes: true, revokedAt: true, lastUsedAt: true } });
  if (!key || key.revokedAt) return apiError(401, "unauthorized", "کلید API نامعتبر یا باطل شده است.");
  if (!key.scopes.includes(scope)) return apiError(403, "forbidden", `این کلید دسترسی «${scope}» ندارد.`);
  const rl = await rateLimit(`api:${key.id}`, API_RATE_PER_MINUTE, 60);
  if (!rl.allowed) return apiError(429, "rate_limited", "تعداد درخواست‌ها بیش از حد مجاز است.", { "Retry-After": "60" });
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  return { keyId: key.id };
}

/** JSON body or null. */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > 20_000) return null;
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}
