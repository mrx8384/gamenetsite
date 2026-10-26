import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { textureVariant } from "../../../src/atom-world/systems/AssetLoader";

const pub = join(__dirname, "../../../public");
const manifest = JSON.parse(readFileSync(join(pub, "atom-world/offline-manifest.json"), "utf8")) as { version: string; assets: { url: string; bytes: number }[] };
const sw = readFileSync(join(pub, "atom-world/sw.js"), "utf8");

describe("offline copy", () => {
  it("the worker and the file list are from the same build (run scripts/build-offline.mjs)", () => {
    expect(sw).toContain(`const VERSION = "${manifest.version}"`);
    expect(sw).not.toContain("__ASSETS__");
  });

  it("lists every model, texture and photo with its current size", () => {
    for (const dir of ["models", "textures", "textures/sm", "photos"]) {
      for (const f of readdirSync(join(pub, "atom-world", dir)).filter((n) => /\.(glb|webp)$/.test(n))) {
        const url = `/atom-world/${dir}/${f}`;
        const entry = manifest.assets.find((a) => a.url === url);
        expect(entry, url).toBeTruthy();
        expect(entry!.bytes, url).toBe(statSync(join(pub, url)).size);
      }
    }
    for (const a of manifest.assets) expect(existsSync(join(pub, a.url)), a.url).toBe(true);
  });

  it("leaves design references and docs out", () => {
    expect(manifest.assets.some((a) => /references\/(ground|upper|entrance|construction)/.test(a.url) || a.url.endsWith(".md"))).toBe(false);
  });

  it("the web app manifest points at existing icons inside /atom-world", () => {
    const m = JSON.parse(readFileSync(join(pub, "atom-world/manifest.webmanifest"), "utf8"));
    expect(m.scope).toBe("/atom-world");
    expect(m.dir).toBe("rtl");
    for (const i of m.icons) expect(existsSync(join(pub, i.src)), i.src).toBe(true);
  });

  it("low quality uses the half-size wall art when there is one", () => {
    expect(textureVariant("/atom-world/textures/mural-upper-back.webp", true)).toBe("/atom-world/textures/sm/mural-upper-back.webp");
    expect(textureVariant("/atom-world/textures/mural-upper-back.webp", false)).toBe("/atom-world/textures/mural-upper-back.webp");
    expect(textureVariant("/atom-world/textures/atom-logo.webp", true)).toBe("/atom-world/textures/atom-logo.webp");
    for (const f of readdirSync(join(pub, "atom-world/textures/sm"))) expect(textureVariant(`/atom-world/textures/${f}`, true)).toBe(`/atom-world/textures/sm/${f}`);
  });
});
