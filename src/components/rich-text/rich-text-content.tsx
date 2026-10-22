import { cn } from "@/lib/utils";

/**
 * Renders HTML produced by renderRichText() on the server (sanitized JSON → HTML).
 * Never pass HTML from any other source.
 */
export function RichTextContent({ html, className }: { html: string; className?: string }) {
  return <div className={cn("prose-atom", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
