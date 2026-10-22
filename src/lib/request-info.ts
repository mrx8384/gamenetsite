import "server-only";
import { headers } from "next/headers";

/**
 * Client IP for rate limiting and audit logs.
 * In production the reverse proxy (nginx) must set `X-Real-IP $remote_addr` and overwrite
 * `X-Forwarded-For`, otherwise these headers can be spoofed by clients.
 */
export async function getRequestInfo(): Promise<{ ip: string; userAgent: string | null }> {
  const h = await headers();
  const realIp = h.get("x-real-ip")?.trim();
  const forwarded = h.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  const ip = realIp || forwarded?.at(-1) || "unknown";
  const userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
  return { ip: ip.slice(0, 45), userAgent };
}
