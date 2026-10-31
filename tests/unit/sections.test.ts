import { describe, expect, it } from "vitest";
import { sectionVisibilitySchema, visibleLinks } from "@/features/settings/sections-schema";
import { mainNav } from "@/lib/nav";

describe("section visibility", () => {
  it("shows everything until the admin hides something", () => {
    const all = sectionVisibilitySchema.parse({});
    expect(Object.values(all).every(Boolean)).toBe(true);
    expect(visibleLinks(mainNav, all)).toHaveLength(mainNav.length);
  });

  it("drops hidden sections and their sub-pages from menus", () => {
    const v = sectionVisibilitySchema.parse({ shop: false, news: false, gameCatalog: false });
    const hrefs = visibleLinks([...mainNav, { href: "/game-catalog/ps5", label: "" }, { href: "/shop/x", label: "" }], v).map((l) => l.href);
    expect(hrefs).not.toContain("/shop");
    expect(hrefs).not.toContain("/news");
    expect(hrefs).not.toContain("/game-catalog/ps5");
    expect(hrefs).not.toContain("/shop/x");
    expect(hrefs).toContain("/contact");
    expect(hrefs).toContain("/tournaments");
  });

  it("keeps the gamepad tester when tournaments are hidden", () => {
    const v = sectionVisibilitySchema.parse({ tournaments: false });
    const hrefs = visibleLinks([{ href: "/tournaments", label: "" }, { href: "/tournaments/gamepad-tester", label: "" }], v).map((l) => l.href);
    expect(hrefs).toEqual(["/tournaments/gamepad-tester"]);
  });

  it("does not confuse /partner-like prefixes", () => {
    const v = sectionVisibilitySchema.parse({ partners: false });
    expect(visibleLinks([{ href: "/partners", label: "" }, { href: "/partner", label: "" }], v).map((l) => l.href)).toEqual(["/partner"]);
  });
});
