import { describe, expect, it } from "vitest";
import { isTestPath } from "../../../src/atom-world/config";
import { allow, readJson, sameOrigin } from "../../../src/atom-world/server/http";
import { validBalls, validEnd } from "../../../src/atom-world/minigames/footPool/FootPoolGame";
import { validSnapshot } from "../../../src/atom-world/minigames/airHockey/AirHockeyGame";

describe("test hooks can't be pointed at real site files", () => {
  it("only /mock-… paths", () => {
    expect(isTestPath("/mock-site/machines.json")).toBe(true);
    expect(isTestPath("/mock-admin/booking")).toBe(true);
    expect(isTestPath("/media/uploads/evil.json")).toBe(false);
    expect(isTestPath("/api/atom-world/events")).toBe(false);
    expect(isTestPath("//evil.example/x.json")).toBe(false);
    expect(isTestPath("/mock-site/../media/x.json")).toBe(false);
    expect(isTestPath("https://evil.example/mock-x/y")).toBe(false);
  });
});

describe("room server guards", () => {
  it("rate limit per key and window", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(allow("t:a", 3, 60_000, t0)).toBe(true);
    expect(allow("t:a", 3, 60_000, t0)).toBe(false);
    expect(allow("t:b", 3, 60_000, t0)).toBe(true);
    expect(allow("t:a", 3, 60_000, t0 + 61_000)).toBe(true);
  });

  it("refuses big bodies before reading them, and junk JSON", async () => {
    const big = new Request("http://x/", { method: "POST", headers: { "content-length": "999999" }, body: "{}" });
    expect(await readJson(big)).toBeNull();
    expect(await readJson(new Request("http://x/", { method: "POST", body: "not json" }))).toBeNull();
    expect(await readJson(new Request("http://x/", { method: "POST", body: '{"a":1}' }))).toEqual({ a: 1 });
  });
});

describe("messages from a friend's phone are checked before use", () => {
  const balls = Array.from({ length: 9 }, () => [0.1, 0.2, 0]);
  it("foot-pool ball lists and final tables", () => {
    expect(validBalls(balls, 9)).toBe(true);
    expect(validBalls(balls.slice(1), 9)).toBe(false);
    expect(validBalls([...balls.slice(1), ["x", 0, 0]], 9)).toBe(false);
    expect(validBalls([...balls.slice(1), [Infinity, 0, 0]], 9)).toBe(false);
    const end = { b: balls, turn: 1, balls2: [2, 3], pocketed: 5, kicks: 9, scratches: 0, over: false };
    expect(validEnd(end, 9)).toBe(true);
    expect(validEnd({ ...end, turn: 2 }, 9)).toBe(false);
    expect(validEnd({ ...end, balls2: [99, 0] }, 9)).toBe(false);
    expect(validEnd(null, 9)).toBe(false);
  });

  it("air-hockey snapshots", () => {
    const snap = { t: "st", p: [0, 0, 1, 1], m: [0, 0.5], a: [0, -0.5], s: [1, 2], over: false, pause: 0 };
    expect(validSnapshot(snap)).toBe(true);
    expect(validSnapshot({ ...snap, p: [0, 0, "1", 1] })).toBe(false);
    expect(validSnapshot({ ...snap, s: [1] })).toBe(false);
    expect(validSnapshot("x")).toBe(false);
  });
});

describe("sameOrigin behind a CDN / reverse proxy", () => {
  const post = (url: string, h: Record<string, string>) => new Request(url, { method: "POST", headers: h });
  it("accepts the site's own address although the app sees http://127.0.0.1", () => {
    // ArvanCloud (https) → nginx (Host kept, X-Forwarded-Proto http) → app on 127.0.0.1
    expect(sameOrigin(post("http://127.0.0.1:3000/api/atom-world/rooms", { origin: "https://www.atomgclub.ir", host: "www.atomgclub.ir", "x-forwarded-proto": "http" }))).toBe(true);
    expect(sameOrigin(post("http://127.0.0.1:3000/x", { origin: "https://site.example", host: "127.0.0.1:3000", "x-forwarded-host": "site.example" }))).toBe(true);
  });
  it("accepts APP_URL's host", () => {
    const old = process.env.APP_URL;
    process.env.APP_URL = "https://www.atomgclub.ir";
    expect(sameOrigin(post("http://127.0.0.1:3000/x", { origin: "https://www.atomgclub.ir", host: "127.0.0.1:3000" }))).toBe(true);
    process.env.APP_URL = old;
  });
  it("still refuses other sites", () => {
    expect(sameOrigin(post("http://127.0.0.1:3000/x", { origin: "https://evil.example", host: "www.atomgclub.ir" }))).toBe(false);
    expect(sameOrigin(post("http://127.0.0.1:3000/x", { origin: "null", host: "www.atomgclub.ir" }))).toBe(false);
  });
});
