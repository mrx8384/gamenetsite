import "server-only";
import { getCurrentUser } from "@/lib/auth/dal";
import { json } from "./http";
import { adminEnabled, isPasswordAdmin, passwordLogin, passwordLogout } from "./passwordLogin";

/**
 * World editor login on the main site. Two ways in, either is enough:
 *  - a logged-in site ADMIN account (the same session as /admin);
 *  - the editor password set on the server: ATOM_WORLD_ADMIN_PASSWORD in /srv/atom/app/.env
 *    (`sudo bash scripts/set-world-password.sh`; unset = only the site login).
 * This file replaces gameatom's password-only version; the editor's routes only use `isAdmin` and
 * the three `session*` handlers (docs/ATOM_WORLD.md).
 */
export const LOGIN_URL = `/login?next=${encodeURIComponent("/atom-world/admin")}`;

type Handler = (req: Request) => Promise<Response>;

/** Is this request from a site ADMIN or from someone logged in with the editor password? */
export const isAdmin: (req: Request) => Promise<boolean> = async (req) => {
  if (isPasswordAdmin(req)) return true;
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
};

/** GET /api/atom-world/admin/session → { enabled, admin, loginUrl, password } */
export const sessionGET: Handler = async (req) => json({ enabled: true, admin: await isAdmin(req), loginUrl: LOGIN_URL, password: adminEnabled() });

/** POST { password } → editor password login (only when the password is set on the server). */
export const sessionPOST: Handler = async (req) => (adminEnabled() ? passwordLogin(req) : json({ error: "site-login", loginUrl: LOGIN_URL }, 405));

/** DELETE → ends the password login (a site login is ended on the site). */
export const sessionDELETE: Handler = async (req) => passwordLogout(req);
