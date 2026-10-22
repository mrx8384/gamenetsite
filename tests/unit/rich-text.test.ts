import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { renderRichText } = await import("@/lib/rich-text/render");
const { sanitizeRichText, richTextToPlain } = await import("@/lib/rich-text/sanitize");

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", content });
const t = (text: string, marks?: unknown[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });

describe("sanitizeRichText", () => {
  it("rejects non-documents", () => {
    expect(sanitizeRichText(null)).toBeNull();
    expect(sanitizeRichText({ type: "paragraph" })).toBeNull();
    expect(sanitizeRichText("<p>x</p>")).toBeNull();
  });
  it("removes javascript: and data: links but keeps the text", () => {
    const out = sanitizeRichText(doc(p(t("bad", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]), t(" ok", [{ type: "link", attrs: { href: "https://atom.ir" } }]))));
    const html = JSON.stringify(out);
    expect(html).not.toContain("javascript:");
    expect(html).toContain("https://atom.ir");
    expect(richTextToPlain(out)).toBe("bad ok");
  });
  it("drops unknown nodes, foreign images and attributes", () => {
    const out = sanitizeRichText(
      doc(
        { type: "iframe", attrs: { src: "https://evil" } },
        { type: "image", attrs: { src: "https://evil.com/x.png", onerror: "alert(1)" } },
        { type: "image", attrs: { src: "/media/news/2026/10/abc123.webp", alt: "ok", onerror: "x" } },
        { type: "heading", attrs: { level: 1, onclick: "x", textAlign: "evil" }, content: [t("تیتر")] },
      ),
    );
    const s = JSON.stringify(out);
    expect(s).not.toContain("iframe");
    expect(s).not.toContain("evil");
    expect(s).not.toContain("onerror");
    expect(s).toContain("/media/news/2026/10/abc123.webp");
    expect(s).toContain('"level":2');
  });
});

describe("renderRichText", () => {
  it("renders safe HTML from JSON, escaping text", () => {
    const r = renderRichText(doc({ type: "heading", attrs: { level: 2, textAlign: "center" }, content: [t("سلام")] }, p(t("<script>alert(1)</script>", [{ type: "bold" }]))))!;
    expect(r.html).toContain("<h2");
    expect(r.html).toContain("text-align: center");
    expect(r.html).toContain("<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>");
    expect(r.html).not.toContain("<script>");
    expect(r.plain).toBe("سلام <script>alert(1)</script>");
  });
  it("adds safe rel/target to links", () => {
    const r = renderRichText(doc(p(t("لینک", [{ type: "link", attrs: { href: "https://example.com" } }]))))!;
    expect(r.html).toContain('rel="noopener noreferrer nofollow"');
    expect(r.html).toContain('href="https://example.com"');
  });
  it("handles an empty document", () => {
    expect(renderRichText({ type: "doc" })!.html).toBe("");
  });
});
