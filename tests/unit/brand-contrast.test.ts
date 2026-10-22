import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { brand } from "@/lib/brand";
import { contrastRatio } from "@/lib/contrast";

const AA_TEXT = 4.5;
const AA_LARGE = 3;

describe("brand colour contrast (WCAG AA)", () => {
  it("black text on atomic green (primary buttons)", () => {
    expect(contrastRatio(brand.black, brand.green)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it("black text on atomic yellow (accent)", () => {
    expect(contrastRatio(brand.black, brand.yellow)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it("deep green links on cream background", () => {
    expect(contrastRatio(brand.greenDeep, brand.cream)).toBeGreaterThanOrEqual(AA_TEXT);
  });
  it("dark green is only for large text / decoration on cream", () => {
    const ratio = contrastRatio(brand.greenDark, brand.cream);
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE);
    expect(ratio).toBeLessThan(AA_TEXT); // documents why greenDeep exists
  });
  it("white text on atomic green fails AA (never use it)", () => {
    expect(contrastRatio(brand.white, brand.green)).toBeLessThan(AA_TEXT);
  });
  it("muted and destructive tokens are readable on cream", () => {
    expect(contrastRatio("#5b5a52", brand.cream)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio("#b42318", brand.cream)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio("#ffffff", "#b42318")).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio("#9a4a00", "#fff6cc")).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe("CSS tokens match brand.ts", () => {
  const css = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8").toLowerCase();
  it.each([
    ["--brand-green", brand.green],
    ["--brand-green-dark", brand.greenDark],
    ["--brand-green-deep", brand.greenDeep],
    ["--brand-cream", brand.cream],
    ["--brand-yellow", brand.yellow],
    ["--brand-black", brand.black],
  ])("%s", (token, hex) => {
    expect(css).toContain(`${token}: ${hex.toLowerCase()};`);
  });
});
