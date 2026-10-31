import { connection, NextResponse, type NextRequest } from "next/server";
import { GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_PATH, googleAuthUrl, googleEnabled, newFlow } from "@/features/auth/google";
import { env } from "@/lib/env";
import { safeRedirectPath } from "@/lib/identifiers";

/** «ادامه با گوگل»: remembers state/PKCE/nonce in a short-lived cookie and sends the visitor to Google. */
export async function GET(req: NextRequest) {
  await connection(); // per request: never prerendered at build time (GOOGLE_* are read at runtime)
  const base = env.APP_URL.replace(/\/+$/, "");
  if (!googleEnabled()) return NextResponse.redirect(`${base}/login?error=google_disabled`);
  const next = safeRedirectPath(req.nextUrl.searchParams.get("next"), "/account");
  const flow = newFlow();
  const res = NextResponse.redirect(googleAuthUrl(flow));
  res.cookies.set(GOOGLE_FLOW_COOKIE, Buffer.from(JSON.stringify({ s: flow.state, v: flow.verifier, n: flow.nonce, next })).toString("base64url"), {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax", // sent on Google's top-level redirect back
    path: GOOGLE_FLOW_PATH,
    maxAge: 600,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
}
