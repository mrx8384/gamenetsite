import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { looksLikeFileName, nameFromFileName, normalizeCategoryName, platformFromSlug } from "@/features/game-catalog/constants";
import { createZip } from "@/lib/zip";

describe("catalog rules (ported from the original app)", () => {
  it("normalizes category names", () => {
    expect(normalizeCategoryName("  ورزشی ")).toBe("ورزشی");
    expect(normalizeCategoryName("")).toBe("بدون دسته");
    expect(normalizeCategoryName(undefined)).toBe("بدون دسته");
    expect(normalizeCategoryName("x".repeat(50))).toHaveLength(40);
  });
  it("derives names from file names like bulk upload did", () => {
    expect(nameFromFileName("God_of-War__Ragnarok.jpg")).toBe("God of War Ragnarok");
    expect(nameFromFileName("FC 26.webp")).toBe("FC 26");
  });
  it("flags names that look like file names", () => {
    for (const n of ["images", "image (2)", "IMG_1234", "IMG 5678", "12345", "Screenshot", "Dead Nation Apocalypse Edition 321x400"]) expect(looksLikeFileName(n)).toBe(true);
    for (const n of ["FC 26", "Pragmata", "Need For Speed Unbound", "Mortal 11 Ultimate"]) expect(looksLikeFileName(n)).toBe(false);
  });
  it("maps platform slugs", () => {
    expect(platformFromSlug("ps5")).toBe("PS5");
    expect(platformFromSlug("xbox")).toBeNull();
  });
});

describe("createZip", () => {
  it("produces an archive that unzip validates, with UTF-8 names", () => {
    const zip = createZip([
      { name: "catalog.json", data: Buffer.from('{"ok":true}') },
      { name: "images/بازی.jpg", data: Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3]) },
    ]);
    const dir = mkdtempSync(path.join(tmpdir(), "zip-"));
    const file = path.join(dir, "t.zip");
    writeFileSync(file, zip);
    const out = execFileSync("unzip", ["-t", file]).toString();
    expect(out).toContain("No errors detected");
    expect(execFileSync("unzip", ["-p", file, "catalog.json"]).toString()).toBe('{"ok":true}');
  });
});
