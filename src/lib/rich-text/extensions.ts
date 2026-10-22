import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import type { Extensions } from "@tiptap/core";

export const SAFE_LINK_RE = /^(https?:\/\/|mailto:|tel:|\/(?![/\\]))/i;
export const MEDIA_SRC_RE = /^\/media\/[a-z0-9-]+(\/[a-z0-9-]+){1,3}\/[a-z0-9-]+\.webp$/;

/** One extension list for both the editor (client) and HTML rendering (server), so output always matches. */
export function richTextExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
      code: false,
      link: {
        openOnClick: false,
        autolink: true,
        protocols: ["http", "https", "mailto", "tel"],
        isAllowedUri: (url) => SAFE_LINK_RE.test(url),
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      },
    }),
    Image.configure({ allowBase64: false, HTMLAttributes: { loading: "lazy" } }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["right", "center", "left", "justify"] }),
  ];
}
