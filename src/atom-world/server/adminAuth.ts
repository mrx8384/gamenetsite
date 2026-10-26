import "server-only";
import { getCurrentUser } from "@/lib/auth/dal";
import { json } from "./http";

/**
 * World editor login on the main site: the site's own ADMIN accounts (the same session as /admin).
 * This file replaces the stand-alone password login of mrx8384/gameatom; the editor's routes only
 * use `isAdmin` and the three `session*` handlers (docs/ATOM_WORLD.md).
 */
export const LOGIN_URL = `/login?next=${encodeURIComponent("/atom-world/admin")}`;

type Handler = (req: Request) => Promise<Response>;

/** Is this request from a logged-in site ADMIN? Checked on the server in every editor route. */
export const isAdmin: (req: Request) => Promise<boolean> = async () => {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
};

/** GET /api/atom-world/admin/session → { enabled, admin, loginUrl } (the editor links to the site login). */
export const sessionGET: Handler = async (req) => json({ enabled: true, admin: await isAdmin(req), loginUrl: LOGIN_URL });

/** No separate password here: log in on the site's login page. */
export const sessionPOST: Handler = async () => json({ error: "site-login", loginUrl: LOGIN_URL }, 405);

/** Logging out is done on the site (the editor does not offer it here). */
export const sessionDELETE: Handler = async () => json({ admin: false });
