import "server-only";

/** Shared bits of the online-room route handlers. */
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

const STATUS: Record<string, number> = { "not-found": 404, full: 409, busy: 503, "bad-request": 400, forbidden: 403, rate: 429 };
export const errorStatus = (e: string) => STATUS[e] ?? 400;

/** Only same-origin pages may write (no cross-site posting into rooms). */
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin navigations
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  // Behind a CDN / reverse proxy (ArvanCloud → nginx → app) the scheme and the URL the app sees differ from the
  // browser's: compare host names only, against every name this request or the site's own address can carry.
  const allowed = new Set<string>();
  const add = (v: string | null | undefined) => v && allowed.add(v.split(",")[0].trim().toLowerCase());
  add(req.headers.get("host"));
  add(req.headers.get("x-forwarded-host"));
  try {
    add(new URL(req.url).host);
  } catch {}
  try {
    if (process.env.APP_URL) add(new URL(process.env.APP_URL).host);
  } catch {}
  return allowed.has(host.toLowerCase());
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<Record<string, unknown> | null> {
  // refuse big bodies before reading them
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return null;
  const text = await req.text();
  if (text.length > maxBytes) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const validCode = (c: string) => /^\d{5}$/.test(c);

/** Visitor address as the proxy reports it (first X-Forwarded-For hop), for rate limits only. */
export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim().slice(0, 64);
}

const g = globalThis as unknown as { __atomRate?: Map<string, { start: number; count: number }> };
const buckets = (g.__atomRate ??= new Map());

/** Fixed-window limit: at most `limit` calls per `windowMs` for a key (e.g. "create:1.2.3.4"). */
export function allow(key: string, limit: number, windowMs = 60_000, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.start > windowMs) buckets.delete(k);
    buckets.set(key, { start: now, count: 1 });
    return true;
  }
  b.count++;
  return b.count <= limit;
}
