import { connection, NextResponse } from "next/server";
import { getPartnerBranding } from "@/features/partners/branding";
import { getCurrentUser } from "@/lib/auth/dal";
import { env } from "@/lib/env";

/** Tab icon of the partner area: the partner's approved logo while white-labelled, otherwise the site icon. */
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  const b = user ? await getPartnerBranding(user.id) : null;
  const target = b ? (b.logoUrl ?? "/partner-icon.svg") : "/icon.png";
  const res = NextResponse.redirect(new URL(target, env.APP_URL), 307);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
