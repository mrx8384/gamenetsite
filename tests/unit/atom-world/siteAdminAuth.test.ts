import { beforeEach, describe, expect, it, vi } from "vitest";

// the site's session store (database) is replaced by a stub: only the role decides
const user = vi.hoisted(() => ({ current: null as null | { role: string } }));
vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: async () => user.current }));

import { isAdmin, LOGIN_URL, sessionGET, sessionPOST } from "../../../src/atom-world/server/adminAuth";

const req = new Request("http://localhost/api/atom-world/admin/session");

describe("world editor login on the site", () => {
  beforeEach(() => {
    user.current = null;
  });

  it("only a site ADMIN may edit the world", async () => {
    expect(await isAdmin(req)).toBe(false);
    for (const role of ["USER", "PARTNER", "SUPPORT"]) {
      user.current = { role };
      expect(await isAdmin(req)).toBe(false);
    }
    user.current = { role: "ADMIN" };
    expect(await isAdmin(req)).toBe(true);
  });

  it("the editor is sent to the site's own login page, and comes back after it", async () => {
    const r = await (await sessionGET(req)).json();
    expect(r).toEqual({ enabled: true, admin: false, loginUrl: LOGIN_URL });
    expect(LOGIN_URL).toBe("/login?next=%2Fatom-world%2Fadmin");
  });

  it("there is no separate editor password", async () => {
    expect((await sessionPOST(new Request("http://localhost/x", { method: "POST", body: '{"password":"x"}' }))).status).toBe(405);
  });
});
