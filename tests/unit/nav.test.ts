import { describe, expect, it } from "vitest";
import { isActivePath, mainNav } from "@/lib/nav";

describe("isActivePath", () => {
  it("matches the section and its sub-pages", () => {
    expect(isActivePath("/shop", "/shop")).toBe(true);
    expect(isActivePath("/shop/dualsense", "/shop")).toBe(true);
  });
  it("does not match unrelated paths with the same prefix", () => {
    expect(isActivePath("/shopping", "/shop")).toBe(false);
    expect(isActivePath("/", "/shop")).toBe(false);
  });
});

describe("mainNav", () => {
  it("has unique, absolute links", () => {
    const hrefs = mainNav.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
  });
});
