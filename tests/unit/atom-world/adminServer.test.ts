import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listVersions, readConfig, readUpload, restoreVersion, saveConfig, saveUpload, sniffImage } from "../../../src/atom-world/server/worldStore";

describe("world store", () => {
  let dir = "";
  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "atom-world-"));
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("saves validated configs, keeps versions and restores them", async () => {
    expect((await readConfig(dir)).updatedAt).toBeNull();
    const a = await saveConfig({ version: 1, texts: { "building-sign": "اول" }, items: { nope: { x: 1 } } }, dir, new Date("2026-10-01T10:00:00.000Z"));
    expect(a.texts["building-sign"]).toBe("اول");
    expect(a.items).toEqual({});
    await saveConfig({ version: 1, texts: { "building-sign": "دوم" } }, dir, new Date("2026-10-02T10:00:00.000Z"));
    expect((await readConfig(dir)).texts["building-sign"]).toBe("دوم");
    const vs = await listVersions(dir);
    expect(vs).toEqual([{ id: "2026-10-01T10-00-00-000Z", updatedAt: "2026-10-01T10:00:00.000Z" }]);
    const back = await restoreVersion(vs[0].id, dir, new Date("2026-10-03T10:00:00.000Z"));
    expect(back?.texts["building-sign"]).toBe("اول");
    expect((await listVersions(dir)).length).toBe(2);
    expect(await restoreVersion("../../etc/passwd", dir)).toBeNull();
  });

  it("accepts only real images and serves them by hash", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 xx");
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(webp)).toBe("webp");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    const r = await saveUpload(png, dir);
    expect("url" in r && r.url).toMatch(/^\/api\/atom-world\/media\/[a-f0-9]{64}\.png$/);
    expect(await saveUpload(new TextEncoder().encode("<html>"), dir)).toEqual({ error: "type" });
    expect(await saveUpload(new Uint8Array(5 * 1024 * 1024), dir)).toEqual({ error: "size" });
    const name = (r as { url: string }).url.split("/").pop()!;
    expect(await readUpload(name, dir)).not.toBeNull();
    expect(await readUpload("../world-config.json", dir)).toBeNull();
  });
});
