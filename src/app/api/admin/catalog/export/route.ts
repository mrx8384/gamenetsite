import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { assertRole, AuthorizationError } from "@/lib/auth/dal";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { createZip } from "@/lib/zip";
import { uploadRoot } from "@/features/media/storage";

/**
 * ZIP backup: catalog.json + images/<id>.webp.
 * Same JSON shape as the original catalog export ({categories, games}), with platform in lowercase.
 */
export async function GET() {
  await connection();
  let actorId: string;
  try {
    actorId = (await assertRole(["ADMIN"])).user.id;
  } catch (e) {
    if (e instanceof AuthorizationError) return new Response("Forbidden", { status: 403 });
    throw e;
  }

  const [categories, games] = await Promise.all([
    db.catalogCategory.findMany({ orderBy: [{ platform: "asc" }, { isDefault: "desc" }, { position: "asc" }, { id: "asc" }], select: { platform: true, name: true } }),
    db.catalogGame.findMany({
      orderBy: [{ position: "asc" }, { id: "asc" }],
      select: { id: true, name: true, platform: true, updatedAt: true, category: { select: { name: true } }, image: { select: { storageKey: true } } },
    }),
  ]);

  const root = uploadRoot();
  const files: { name: string; data: Uint8Array; date?: Date }[] = [];
  const out: { id: string; name: string; platform: string; category: string; image: string }[] = [];
  for (const g of games) {
    const file = path.resolve(root, g.image.storageKey);
    if (!file.startsWith(root + path.sep)) continue;
    const name = `images/${g.id}.webp`;
    try {
      files.push({ name, data: await readFile(file), date: g.updatedAt });
    } catch {
      continue; // missing file: skip the image entry but keep the game listed without it
    }
    out.push({ id: g.id, name: g.name, platform: g.platform.toLowerCase(), category: g.category.name, image: name });
  }
  const json = JSON.stringify({ categories: categories.map((c) => ({ platform: c.platform.toLowerCase(), name: c.name })), games: out }, null, 1);
  files.unshift({ name: "catalog.json", data: Buffer.from(json, "utf8") });

  const zip = createZip(files);
  await audit({ actorId, action: "catalog.exported", entity: "catalog", entityId: null, meta: { games: out.length } as never });
  const stamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.byteLength),
      "Content-Disposition": `attachment; filename="atom-catalog-${stamp}.zip"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
