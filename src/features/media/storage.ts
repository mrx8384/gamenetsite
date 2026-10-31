import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { generateToken, sha256Hex } from "@/lib/auth/crypto";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB per file
const ALLOWED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif"]);
const MAX_INPUT_PIXELS = 40_000_000; // guards against decompression bombs

export class UploadError extends Error {}

export function uploadRoot(): string {
  return path.resolve(env.UPLOAD_DIR);
}

/**
 * Validates an uploaded image by decoding it (not by trusting the file name or MIME type),
 * re-encodes it to WebP (drops metadata and any embedded payload) and stores it.
 */
export async function storeImage(
  input: Buffer,
  opts: { folder: "products" | "categories" | "news" | "catalog" | "organizations"; uploaderId: string | null; maxWidth?: number; originalName?: string },
) {
  if (input.byteLength === 0) throw new UploadError("فایل خالی است.");
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new UploadError("حجم هر تصویر باید حداکثر ۵ مگابایت باشد.");

  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new UploadError("فایل انتخاب‌شده تصویر معتبری نیست.");
  }
  if (!meta.format || !ALLOWED_INPUT_FORMATS.has(meta.format)) {
    throw new UploadError("فقط تصاویر JPG، PNG، WebP، AVIF یا GIF مجاز است.");
  }

  const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
    .rotate() // apply EXIF orientation, then metadata is stripped
    .resize({ width: opts.maxWidth ?? 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const now = new Date();
  const dir = `${opts.folder}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const name = generateToken(12).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || generateToken(8);
  const storageKey = `${dir}/${name}.webp`;
  const absolute = path.join(uploadRoot(), storageKey);

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data, { flag: "wx" });

  return db.media.create({
    data: {
      storageKey,
      originalName: opts.originalName?.slice(0, 255) ?? null,
      mimeType: "image/webp",
      size: data.byteLength,
      width: info.width,
      height: info.height,
      sha256: sha256Hex(data.toString("base64")),
      uploaderId: opts.uploaderId,
    },
    select: { id: true, storageKey: true, width: true, height: true },
  });
}

/** Deletes media rows that nothing references anymore, and their files. Used when catalog images are replaced/removed. */
export async function deleteUnusedMedia(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const unused = await db.media.findMany({
    where: { id: { in: ids }, catalogGames: { none: {} }, productImages: { none: {} }, newsCovers: { none: {} }, categoryImages: { none: {} }, organizations: { none: {} } },
    select: { id: true, storageKey: true },
  });
  for (const m of unused) {
    await unlink(path.join(uploadRoot(), m.storageKey)).catch(() => {});
  }
  await db.media.deleteMany({ where: { id: { in: unused.map((m) => m.id) } } });
  return unused.length;
}
