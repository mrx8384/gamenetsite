import { MEDIA_SRC_RE, SAFE_LINK_RE } from "./extensions";

/** Minimal ProseMirror JSON node shape. */
export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

const NODES = new Set([
  "doc", "paragraph", "text", "heading", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "horizontalRule", "image",
]);
const MARKS = new Set(["bold", "italic", "underline", "strike", "link"]);
const ALIGN = new Set(["right", "center", "left", "justify"]);
const MAX_DEPTH = 20;

function cleanMarks(marks: RichNode["marks"]): RichNode["marks"] {
  if (!Array.isArray(marks)) return undefined;
  const out = marks
    .filter((m) => m && typeof m.type === "string" && MARKS.has(m.type))
    .flatMap((m) => {
      if (m.type !== "link") return [{ type: m.type }];
      const href = typeof m.attrs?.href === "string" ? m.attrs.href.trim() : "";
      return SAFE_LINK_RE.test(href) ? [{ type: "link", attrs: { href } }] : []; // drop javascript:, data:, etc.
    });
  return out.length ? out : undefined;
}

function cleanNode(node: unknown, depth: number): RichNode | null {
  if (!node || typeof node !== "object" || depth > MAX_DEPTH) return null;
  const n = node as RichNode;
  if (typeof n.type !== "string" || !NODES.has(n.type)) return null;

  if (n.type === "text") {
    if (typeof n.text !== "string" || n.text.length === 0) return null;
    return { type: "text", text: n.text.slice(0, 10000), marks: cleanMarks(n.marks) };
  }
  if (n.type === "image") {
    const src = typeof n.attrs?.src === "string" ? n.attrs.src : "";
    if (!MEDIA_SRC_RE.test(src)) return null; // only our own uploaded images
    const alt = typeof n.attrs?.alt === "string" ? n.attrs.alt.slice(0, 200) : "";
    return { type: "image", attrs: { src, alt } };
  }

  const attrs: Record<string, unknown> = {};
  if (n.type === "heading") attrs.level = n.attrs?.level === 3 ? 3 : 2;
  if ((n.type === "heading" || n.type === "paragraph") && typeof n.attrs?.textAlign === "string" && ALIGN.has(n.attrs.textAlign)) {
    attrs.textAlign = n.attrs.textAlign;
  }
  if (n.type === "orderedList" && Number.isInteger(n.attrs?.start)) attrs.start = Math.max(1, Math.min(10000, n.attrs!.start as number));

  const content = Array.isArray(n.content) ? n.content.map((c) => cleanNode(c, depth + 1)).filter((c): c is RichNode => c !== null) : undefined;
  return { type: n.type, ...(Object.keys(attrs).length ? { attrs } : {}), ...(content?.length ? { content } : {}) };
}

/** Returns a safe document (unknown nodes/marks removed, links and images restricted), or null if invalid. */
export function sanitizeRichText(input: unknown): RichNode | null {
  if (!input || typeof input !== "object" || (input as RichNode).type !== "doc") return null;
  if (JSON.stringify(input).length > 500_000) return null;
  return cleanNode(input, 0) ?? { type: "doc" };
}

/** Plain text (for excerpts, search snippets and emptiness checks). */
export function richTextToPlain(doc: RichNode | null): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === "text" && n.text) parts.push(n.text);
    if (n.type === "hardBreak") parts.push(" ");
    n.content?.forEach(walk);
    if (["paragraph", "heading", "listItem", "blockquote"].includes(n.type)) parts.push(" ");
  };
  walk(doc);
  return parts.join("").replace(/\s+/g, " ").trim();
}
