import { describe, expect, it, vi } from "vitest";
import { breadcrumbJsonLd, jsonLdHtml, metaDescription, pageMetadata, seoPath } from "@/lib/seo";

vi.mock("@/lib/env", () => ({ env: { APP_URL: "https://www.example.ir" } }));

describe("seo helpers", () => {
  it("encodes Persian slugs segment by segment", () => {
    expect(seoPath("shop", "دسته-ps5")).toBe(`/shop/${encodeURIComponent("دسته-ps5")}`);
    expect(seoPath("news", "a/b")).toBe("/news/a%2Fb");
  });

  it("builds canonical + full Open Graph block", () => {
    const m = pageMetadata({ title: "فروشگاه", description: "توضیح", path: "/shop" });
    expect(m.title).toBe("فروشگاه");
    expect(m.alternates?.canonical).toBe("/shop");
    expect(m.openGraph).toMatchObject({ url: "/shop", locale: "fa_IR", title: "فروشگاه | اتم گیم کلاب", description: "توضیح" });
    const home = pageMetadata({ title: "x", absoluteTitle: "عنوان کامل", path: "/" });
    expect(home.title).toEqual({ absolute: "عنوان کامل" });
    expect(home.openGraph?.title).toBe("عنوان کامل");
  });

  it("uses a large card only when a page image exists", () => {
    expect(pageMetadata({ title: "a", path: "/a", image: "/media/x.webp" }).twitter).toMatchObject({ card: "summary_large_image" });
    expect(pageMetadata({ title: "a", path: "/a" }).twitter).toMatchObject({ card: "summary" });
  });

  it("shortens descriptions on a word boundary", () => {
    expect(metaDescription("  کوتاه   است ")).toBe("کوتاه است");
    expect(metaDescription("")).toBeUndefined();
    const long = metaDescription("کلمه ".repeat(80), 40)!;
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long.endsWith("…")).toBe(true);
  });

  it("builds breadcrumbs from the homepage down", () => {
    const b = breadcrumbJsonLd("https://www.example.ir", [["فروشگاه", "/shop"]]);
    expect(b.itemListElement.map((i) => [i.position, i.item])).toEqual([
      [1, "https://www.example.ir/"],
      [2, "https://www.example.ir/shop"],
    ]);
  });

  it("escapes < in JSON-LD", () => {
    expect(jsonLdHtml({ a: "</script>" })).not.toContain("</");
  });
});

/** Google-style matching: prefix, `*` wildcard, `$` end anchor. */
function blocked(path: string, rules: string[]) {
  return rules.some((r) => new RegExp("^" + r.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$").replace(/\$$/, "$")).test(path));
}

describe("robots.txt", () => {
  it("keeps public pages crawlable and private ones blocked", async () => {
    const { default: robots } = await import("@/app/robots");
    const rules = robots().rules;
    const disallow = [(Array.isArray(rules) ? rules[0] : rules).disallow ?? []].flat();
    for (const p of ["/", "/partners", "/shop", "/shop/x", "/tournaments/x", "/news", "/atom-world", "/game-catalog/ps5"]) expect(blocked(p, disallow), p).toBe(false);
    for (const p of ["/partner", "/partner/tournaments", "/admin", "/account/orders", "/atom-world/admin", "/shop?q=x", "/api/support"]) expect(blocked(p, disallow), p).toBe(true);
  });
});
