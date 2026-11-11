import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const base = { DATABASE_URL: "postgresql://u:p@localhost:5432/db", AUTH_SECRET: "x".repeat(40), APP_URL: "https://example.ir" };

async function load(extra: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "test");
  for (const [k, v] of Object.entries({ ...base, ...extra })) vi.stubEnv(k, v);
  return (await import("@/lib/env")).env;
}

describe("optional GameNet settings never stop the site", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("invalid download link is ignored", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = await load({ GAMENET_APP_DOWNLOAD_URL: "لینک دانلود برنامه", GAMENET_LICENSE_API_URL: "https://lic.example.ir", GAMENET_LICENSE_API_KEY: "gnk_abc" });
    expect(env.GAMENET_APP_DOWNLOAD_URL).toBeUndefined();
    expect(env.GAMENET_LICENSE_API_KEY).toBe("gnk_abc");
    expect(warn.mock.calls.join(" ")).not.toContain("gnk_abc");
  });
  it("bad key or a lone half of the pair turns the section off", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let env = await load({ GAMENET_LICENSE_API_URL: "https://lic.example.ir", GAMENET_LICENSE_API_KEY: "wrongkey" });
    expect(env.GAMENET_LICENSE_API_URL).toBeUndefined();
    expect(env.GAMENET_LICENSE_API_KEY).toBeUndefined();
    env = await load({ GAMENET_LICENSE_API_URL: "آدرس سرور", GAMENET_LICENSE_API_KEY: "gnk_abc" });
    expect(env.GAMENET_LICENSE_API_KEY).toBeUndefined();
  });
});
