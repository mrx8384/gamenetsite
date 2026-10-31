import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { checkGoogleClaims, type ClaimsError, type GoogleClaims } from "./google-claims";

export const GOOGLE_FLOW_COOKIE = "atom_google_oauth";
export const GOOGLE_FLOW_PATH = "/api/auth/google";

export function googleEnabled(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${env.APP_URL.replace(/\/+$/, "")}${GOOGLE_FLOW_PATH}/callback`;
}

const b64url = (b: Buffer) => b.toString("base64url");

/** state + PKCE verifier + nonce for one sign-in attempt. */
export function newFlow() {
  const verifier = b64url(randomBytes(32));
  return {
    state: b64url(randomBytes(16)),
    nonce: b64url(randomBytes(16)),
    verifier,
    challenge: b64url(createHash("sha256").update(verifier).digest()),
  };
}

export function googleAuthUrl(flow: { state: string; nonce: string; challenge: string }): string {
  const q = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: flow.challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/** Exchanges the code for tokens (server to server) and checks the ID token claims. */
export async function exchangeGoogleCode(code: string, verifier: string, nonce: string): Promise<{ ok: true; claims: GoogleClaims } | { ok: false; error: ClaimsError | "exchange" }> {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.error("[google] token request failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "exchange" };
  }
  const body = (await res.json().catch(() => null)) as { id_token?: string; error?: string } | null;
  if (!res.ok || !body?.id_token) {
    // Google's error code only (e.g. invalid_grant, invalid_client) — never the secret or tokens.
    console.error(`[google] token exchange refused: HTTP ${res.status} ${body?.error ?? ""}`);
    return { ok: false, error: "exchange" };
  }
  return checkGoogleClaims(body.id_token, { clientId: env.GOOGLE_CLIENT_ID!, nonce, nowSeconds: Math.floor(Date.now() / 1000) });
}

/**
 * The site account for a Google account: the linked one, else the account with the same email
 * (Google verified it, and site emails are verified at sign-up), else a new account.
 */
export async function resolveGoogleUser(c: GoogleClaims): Promise<{ userId: string; isActive: boolean; created: boolean; linked: boolean }> {
  const link = await db.oAuthAccount.findUnique({ where: { provider_subject: { provider: "google", subject: c.sub } }, select: { user: { select: { id: true, isActive: true } } } });
  if (link) return { userId: link.user.id, isActive: link.user.isActive, created: false, linked: false };

  const existing = await db.user.findUnique({ where: { email: c.email }, select: { id: true, isActive: true, emailVerifiedAt: true } });
  if (existing) {
    await db.$transaction([
      db.oAuthAccount.create({ data: { provider: "google", subject: c.sub, userId: existing.id, email: c.email } }),
      ...(existing.emailVerifiedAt ? [] : [db.user.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date() } })]),
    ]);
    return { userId: existing.id, isActive: existing.isActive, created: false, linked: true };
  }

  // No password chosen: an unguessable one; the user can set a real one with «فراموشی رمز» (email code).
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const user = await db.user.create({
    data: { name: c.name, email: c.email, emailVerifiedAt: new Date(), passwordHash, oauthAccounts: { create: { provider: "google", subject: c.sub, email: c.email } } },
    select: { id: true },
  });
  return { userId: user.id, isActive: true, created: true, linked: false };
}
