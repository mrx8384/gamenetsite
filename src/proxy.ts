import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Canonical host: `www.<domain>` → `<domain>` from APP_URL (one address for Google, cookies
 *    and the same-origin checks of admin uploads).
 * 2. Optimistic check only: redirects visitors without a session cookie away from private areas.
 *    Real authorization happens on the server in every page and action (src/lib/auth/dal.ts).
 */
const SESSION_COOKIES = ["__Host-atom_session", "atom_session"];
const PRIVATE = [/^\/account(\/|$)/, /^\/admin(\/|$)/, /^\/checkout$/, /^\/partner(\/|$)/];

let appHost: string | null = null;
try {
  appHost = new URL(process.env.APP_URL ?? "").host;
} catch {
  appHost = null;
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase();
  if (appHost && host === `www.${appHost}`) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, process.env.APP_URL);
    return NextResponse.redirect(target, 308); // 308 keeps the method for POSTs
  }

  const { pathname } = request.nextUrl;
  if (PRIVATE.some((re) => re.test(pathname))) {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Everything except build assets and uploaded media (they are cacheable and host-independent).
  matcher: ["/((?!_next/static|_next/image|media/).*)"],
};
