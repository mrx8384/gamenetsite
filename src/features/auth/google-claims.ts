/**
 * Pure checks of the Google ID token claims («ادامه با گوگل»). The token comes straight from Google's
 * token endpoint over TLS, authenticated with our client secret, so — as OpenID Connect Core §3.1.3.7
 * allows — its signature is not re-verified here; issuer, audience, expiry, nonce and email are.
 */
export interface GoogleClaims {
  sub: string;
  email: string;
  name: string;
}

export type ClaimsError = "malformed" | "issuer" | "audience" | "expired" | "nonce" | "email_unverified";

function decodePayload(idToken: string): Record<string, unknown> | null {
  const part = idToken.split(".")[1];
  if (!part) return null;
  try {
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const v: unknown = JSON.parse(json);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function checkGoogleClaims(idToken: string, opts: { clientId: string; nonce: string; nowSeconds: number }): { ok: true; claims: GoogleClaims } | { ok: false; error: ClaimsError } {
  const p = decodePayload(idToken);
  if (!p || typeof p.sub !== "string" || !p.sub) return { ok: false, error: "malformed" };
  if (p.iss !== "https://accounts.google.com" && p.iss !== "accounts.google.com") return { ok: false, error: "issuer" };
  const aud = Array.isArray(p.aud) ? p.aud : [p.aud];
  if (!aud.includes(opts.clientId)) return { ok: false, error: "audience" };
  if (typeof p.exp !== "number" || p.exp < opts.nowSeconds - 60) return { ok: false, error: "expired" };
  if (p.nonce !== opts.nonce) return { ok: false, error: "nonce" };
  if (typeof p.email !== "string" || !p.email.includes("@") || (p.email_verified !== true && p.email_verified !== "true")) {
    return { ok: false, error: "email_unverified" };
  }
  const email = p.email.trim().toLowerCase();
  const rawName = typeof p.name === "string" && p.name.trim() ? p.name : email.split("@")[0];
  return { ok: true, claims: { sub: p.sub, email, name: rawName.replace(/\s+/g, " ").trim().slice(0, 100) } };
}

/** Messages for /login?error=… (never reveal details). */
export const GOOGLE_ERRORS: Record<string, string> = {
  google_disabled: "ورود با گوگل فعلاً فعال نیست.",
  google_cancelled: "ورود با گوگل لغو شد.",
  google_expired: "زمان ورود با گوگل تمام شد؛ دوباره امتحان کنید.",
  google_failed: "ورود با گوگل انجام نشد. کمی بعد دوباره امتحان کنید یا با رمز عبور وارد شوید.",
  google_unverified: "ایمیل حساب گوگل شما تأیید نشده است.",
  google_inactive: "حساب کاربری شما غیرفعال شده است. با پشتیبانی تماس بگیرید.",
  google_limited: "تعداد تلاش‌ها زیاد بود. چند دقیقه بعد دوباره امتحان کنید.",
};
