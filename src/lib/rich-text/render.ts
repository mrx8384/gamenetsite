import "server-only";
import { generateHTML } from "@tiptap/html/server";
import { richTextExtensions } from "./extensions";
import { richTextToPlain, sanitizeRichText, type RichNode } from "./sanitize";

export interface RenderedRichText {
  json: RichNode;
  html: string;
  plain: string;
}

/** Sanitizes editor JSON and renders HTML on the server. Raw HTML from clients is never stored. */
export function renderRichText(input: unknown): RenderedRichText | null {
  const json = sanitizeRichText(input);
  if (!json) return null;
  const html = json.content?.length ? generateHTML(json as Parameters<typeof generateHTML>[0], richTextExtensions()) : "";
  return { json, html, plain: richTextToPlain(json) };
}
