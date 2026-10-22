import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: redirects visitors without a session cookie away from private areas.
 * Real authorization happens on the server in every page and action (src/lib/auth/dal.ts).
 */
const SESSION_COOKIES = ["__Host-atom_session", "atom_session"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
