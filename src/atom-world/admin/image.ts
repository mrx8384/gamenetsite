"use client";

/**
 * Shrinks a picked photo in the browser before it is stored: at most `maxSide` pixels, WebP (or
 * JPEG where the browser cannot write WebP). Phone photos of 5–10 MB become a few hundred KB.
 */
export async function prepareImage(file: Blob, maxSide: number): Promise<Blob> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("type");
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = (type: string) => new Promise<Blob | null>((res) => c.toBlob(res, type, 0.82));
  const webp = await blob("image/webp");
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await blob("image/jpeg");
  if (!jpg) throw new Error("encode");
  return jpg;
}
