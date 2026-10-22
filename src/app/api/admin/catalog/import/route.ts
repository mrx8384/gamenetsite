import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { CatalogImportError, importCatalogDatabase } from "@/features/game-catalog/importer";

/** Max size of an uploaded catalog.db. The owner's current file is ~4 MB. */
const MAX_IMPORT_BYTES = 200 * 1024 * 1024;
let importRunning = false;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Restores the catalog from an original catalog.db (schema v1/v2). Body = raw file bytes.
 * Replaces the whole catalog; the admin UI asks for confirmation first.
 */
export async function POST(request: Request) {
  await connection();
  // CSRF: browsers always send Origin on cross-origin POST; require it to be our own site.
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(env.APP_URL).origin) return json({ ok: false, error: "درخواست نامعتبر است." }, 403);

  let actorId: string;
  try {
    actorId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return json({ ok: false, error: "دسترسی غیرمجاز." }, 403);
    throw e;
  }
  if (!(await rateLimit(`catalog-import:${actorId}`, 10, 60 * 60)).allowed) return json({ ok: false, error: "تعداد دفعات بازیابی بیش از حد مجاز است. کمی بعد تلاش کنید." }, 429);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_IMPORT_BYTES) return json({ ok: false, error: "حجم فایل بیش از ۲۰۰ مگابایت است." }, 413);
  if (!request.body) return json({ ok: false, error: "فایلی ارسال نشده است." }, 400);
  if (importRunning) return json({ ok: false, error: "یک بازیابی دیگر در حال انجام است." }, 409);

  importRunning = true;
  const dir = await mkdtemp(path.join(tmpdir(), "atom-catalog-"));
  const file = path.join(dir, "upload.db");
  try {
    let size = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        size += chunk.byteLength;
        cb(size > MAX_IMPORT_BYTES ? new CatalogImportError("حجم فایل بیش از ۲۰۰ مگابایت است.") : null, chunk);
      },
    });
    await pipeline(Readable.fromWeb(request.body as never), limiter, createWriteStream(file, { mode: 0o600 }));
    if (size === 0) return json({ ok: false, error: "فایل خالی است." }, 400);

    const rawName = request.headers.get("x-file-name") ?? "catalog.db";
    let fileName = "catalog.db";
    try {
      fileName = decodeURIComponent(rawName).slice(0, 200);
    } catch {}
    const summary = await importCatalogDatabase(file, { fileName, actorId });
    revalidateTag(CACHE_TAGS.catalog, { expire: 0 });
    return json({ ok: true, summary });
  } catch (e) {
    if (e instanceof CatalogImportError) return json({ ok: false, error: e.message }, 400);
    console.error("[catalog-import] failed", e);
    return json({ ok: false, error: "بازیابی ناموفق بود. کاتالوگ فعلی تغییری نکرد." }, 500);
  } finally {
    importRunning = false;
    await rm(dir, { recursive: true, force: true });
  }
}
