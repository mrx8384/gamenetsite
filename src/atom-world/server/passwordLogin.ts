import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { allow, clientIp, json, readJson, sameOrigin } from "./http";

/**
 * The world editor's own password, set on the server (shared by this repo and the main site):
 *   ATOM_WORLD_ADMIN_PASSWORD   at least 10 characters; unset = no password login
 *   ATOM_WORLD_ADMIN_SECRET     optional key for the login cookie (default: derived from the password,
 *                               so changing the password signs everybody out)
 * Login = an HttpOnly, SameSite=Strict cookie signed with HMAC, valid 12 hours.
 */
export const COOKIE = "atom_world_admin";
const TTL_MS = 12 * 60 * 60 * 1000;

function password(env = process.env) {
  const p = env.ATOM_WORLD_ADMIN_PASSWORD ?? "";
  return p.length >= 10 ? p : null;
}

export const adminEnabled = (env = process.env) => password(env) !== null;

function secret(env = process.env) {
  return env.ATOM_WORLD_ADMIN_SECRET || createHash("sha256").update(`atom-world-admin:${password(env)}`).digest("hex");
}

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Constant-time password check (both sides hashed to the same length first). */
export function checkPassword(input: unknown, env = process.env) {
  const p = password(env);
  if (!p || typeof input !== "string" || input.length > 200) return false;
  return timingSafeEqual(digest(input), digest(p));
}

const sign = (payload: string, env = process.env) => createHmac("sha256", secret(env)).update(payload).digest("base64url");

export function createToken(now = Date.now(), env = process.env) {
  const payload = `v1.${now + TTL_MS}`;
  return `${payload}.${sign(payload, env)}`;
}

export function verifyToken(token: string | undefined | null, now = Date.now(), env = process.env) {
  if (!token || !adminEnabled(env)) return false;
  const m = /^(v1\.(\d{10,16}))\.([\w-]{43})$/.exec(token);
  if (!m) return false;
  if (Number(m[2]) < now) return false;
  const want = Buffer.from(sign(m[1], env));
  const got = Buffer.from(m[3]);
  return want.length === got.length && timingSafeEqual(want, got);
}

function cookieValue(req: Request, name: string) {
  const h = req.headers.get("cookie") ?? "";
  for (const part of h.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function secure(req: Request) {
  return (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https";
}
export function sessionCookie(req: Request, token: string) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_MS / 1000}${secure(req) ? "; Secure" : ""}`;
}
export function clearCookie(req: Request) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure(req) ? "; Secure" : ""}`;
}

export const isPasswordAdmin = (req: Request) => verifyToken(cookieValue(req, COOKIE));

/** POST { password } → sets the login cookie (a few tries a minute per address). */
export async function passwordLogin(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  if (!adminEnabled()) return json({ error: "disabled" }, 503);
  if (!allow(`admin-login:${clientIp(req)}`, 5)) return json({ error: "rate" }, 429);
  const body = await readJson(req, 2048);
  if (!body || !checkPassword(body.password)) return json({ error: "wrong-password" }, 401);
  const res = json({ admin: true });
  res.headers.append("set-cookie", sessionCookie(req, createToken()));
  return res;
}

/** DELETE → clears the login cookie. */
export function passwordLogout(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const res = json({ admin: false });
  res.headers.append("set-cookie", clearCookie(req));
  return res;
}
