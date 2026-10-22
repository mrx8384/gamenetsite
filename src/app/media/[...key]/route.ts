import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { uploadRoot } from "@/features/media/storage";

const SEGMENT = /^[a-z0-9-]{1,64}$/;
const FILE = /^[a-z0-9-]{1,64}\.(webp)$/;
const TYPES: Record<string, string> = { webp: "image/webp" };

/** Serves uploaded files. Keys are random and immutable, so responses are cached long-term. */
export async function GET(_request: Request, { params }: RouteContext<"/media/[...key]">) {
  const { key } = await params;
  const parts = key ?? [];
  const valid = parts.length >= 2 && parts.length <= 5 && parts.slice(0, -1).every((p) => SEGMENT.test(p)) && FILE.test(parts.at(-1)!);
  if (!valid) return new Response("Not found", { status: 404 });

  const root = uploadRoot();
  const file = path.resolve(root, ...parts);
  if (!file.startsWith(root + path.sep)) return new Response("Not found", { status: 404 });

  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(file);
    const ext = file.split(".").pop()!;
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": TYPES[ext],
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
