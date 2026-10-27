import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// the site's session store (database) is replaced by a stub: only the role decides
const user = vi.hoisted(() => ({ current: null as null | { role: string } }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: async () => user.current }));

import { isAdmin, LOGIN_URL, sessionDELETE, sessionGET, sessionPOST } from "../../../src/atom-world/server/adminAuth";

const req = (init?: RequestInit, cookie?: string) =>
  new Request("http://localhost/api/atom-world/admin/session", { ...init, headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" } });

describe("world editor login on the site", () => {
  beforeEach(() => {
    user.current = null;
    delete process.env.ATOM_WORLD_ADMIN_PASSWORD;
  });
  afterEach(() => {
    delete process.env.ATOM_WORLD_ADMIN_PASSWORD;
  });

  it("a site ADMIN may edit the world; other roles may not", async () => {
    expect(await isAdmin(req())).toBe(false);
    for (const role of ["USER", "PARTNER", "SUPPORT"]) {
      user.current = { role };
      expect(await isAdmin(req())).toBe(false);
    }
    user.current = { role: "ADMIN" };
    expect(await isAdmin(req())).toBe(true);
  });

  it("without a server password: only the site login (link back to the editor)", async () => {
    expect(await (await sessionGET(req())).json()).toEqual({ enabled: true, admin: false, loginUrl: LOGIN_URL, password: false });
    expect(LOGIN_URL).toBe("/login?next=%2Fatom-world%2Fadmin");
    expect((await sessionPOST(req({ method: "POST", body: '{"password":"anything-long"}' }))).status).toBe(405);
  });

  it("with ATOM_WORLD_ADMIN_PASSWORD set on the server: the password logs in, a wrong one does not", async () => {
    process.env.ATOM_WORLD_ADMIN_PASSWORD = "vps-password-2026";
    expect((await (await sessionGET(req())).json()).password).toBe(true);
    expect((await sessionPOST(req({ method: "POST", body: '{"password":"wrong-password-1"}' }))).status).toBe(401);
    const ok = await sessionPOST(req({ method: "POST", body: '{"password":"vps-password-2026"}' }));
    expect(ok.status).toBe(200);
    const cookie = ok.headers.get("set-cookie")!.split(";")[0];
    expect(cookie).toMatch(/^atom_world_admin=v1\./);
    expect(await isAdmin(req(undefined, cookie))).toBe(true);
    // a changed password signs that cookie out
    process.env.ATOM_WORLD_ADMIN_PASSWORD = "another-password-99";
    expect(await isAdmin(req(undefined, cookie))).toBe(false);
    expect((await sessionDELETE(req({ method: "DELETE" }))).headers.get("set-cookie")).toMatch(/Max-Age=0/);
  });
});
