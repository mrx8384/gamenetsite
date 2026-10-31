import { timingSafeEqual } from "node:crypto";
import { connection, NextResponse, type NextRequest } from "next/server";
import { exchangeGoogleCode, GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_PATH, googleEnabled, resolveGoogleUser } from "@/features/auth/google";
import { audit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { safeRedirectPath } from "@/lib/identifiers";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestInfo } from "@/lib/request-info";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function readFlow(raw: string | undefined): { s: string; v: string; n: string; next: string } | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof f.s === "string" && typeof f.v === "string" && typeof f.n === "string" ? { s: f.s, v: f.v, n: f.n, next: typeof f.next === "string" ? f.next : "/account" } : null;
  } catch {
    return null;
  }
}

/** Google redirects here with ?code&state. Checks state, exchanges the code, signs the visitor in. */
export async function GET(req: NextRequest) {
  await connection(); // per request: never prerendered at build time (GOOGLE_* are read at runtime)
  const base = env.APP_URL.replace(/\/+$/, "");
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${base}/login?error=${code}`);
    res.cookies.set(GOOGLE_FLOW_COOKIE, "", { path: GOOGLE_FLOW_PATH, maxAge: 0 });
    return res;
  };
  if (!googleEnabled()) return fail("google_disabled");

  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("google_cancelled"); // e.g. access_denied: the visitor closed Google's page
  const flow = readFlow(req.cookies.get(GOOGLE_FLOW_COOKIE)?.value);
  const state = params.get("state") ?? "";
  const code = params.get("code") ?? "";
  if (!flow) return fail("google_expired");
  if (!code || !same(state, flow.s)) return fail("google_failed");

  const { ip, userAgent } = await getRequestInfo();
  if (!(await rateLimit(`google:ip:${ip}`, 20, 15 * 60)).allowed) return fail("google_limited");

  const result = await exchangeGoogleCode(code, flow.v, flow.n);
  if (!result.ok) return fail(result.error === "email_unverified" ? "google_unverified" : "google_failed");

  let account: Awaited<ReturnType<typeof resolveGoogleUser>>;
  try {
    account = await resolveGoogleUser(result.claims);
  } catch (e) {
    console.error("[google] account resolution failed:", e instanceof Error ? e.message : e);
    return fail("google_failed");
  }
  if (!account.isActive) return fail("google_inactive");

  await createSession(account.userId, { ip, userAgent });
  await audit({
    actorId: account.userId,
    action: account.created ? "auth.register" : "auth.login",
    entity: "user",
    entityId: account.userId,
    ip,
    meta: { method: "google", ...(account.linked ? { linkedExistingEmail: true } : {}) },
  });
  const res = NextResponse.redirect(`${base}${safeRedirectPath(flow.next, "/account")}`);
  res.cookies.set(GOOGLE_FLOW_COOKIE, "", { path: GOOGLE_FLOW_PATH, maxAge: 0 });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
