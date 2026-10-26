import { MEDIA_NAME, MEDIA_TYPE, readUpload } from "@/atom-world/server/worldStore";

/** GET an image uploaded in the world editor (named by its content hash, so it never changes). */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const m = MEDIA_NAME.exec(file);
  const bytes = m ? await readUpload(file) : null;
  if (!m || !bytes) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": MEDIA_TYPE[m[1] as keyof typeof MEDIA_TYPE],
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}
