import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { EMPTY_WORLD_CONFIG, parseWorldConfig, type WorldConfig } from "../world/config";

/**
 * Where the world editor keeps its data: one JSON file with the current config, the last versions
 * (to undo a save) and the uploaded images. Folder: ATOM_WORLD_DATA_DIR; else, on the main site,
 * an «atom-world» folder beside its UPLOAD_DIR; else .data/atom-world in the project. It must survive
 * deploys (outside the app folder, or a mounted volume).
 */
export function dataDir(env = process.env) {
  if (env.ATOM_WORLD_DATA_DIR) return env.ATOM_WORLD_DATA_DIR;
  // on the main site: beside its upload folder (outside the app, kept by updates), e.g. /srv/atom/atom-world
  if (env.UPLOAD_DIR) return path.join(path.dirname(path.resolve(env.UPLOAD_DIR)), "atom-world");
  return path.join(process.cwd(), ".data", "atom-world");
}

const KEEP_VERSIONS = 20;
export const MAX_UPLOAD = 4 * 1024 * 1024;

const file = (dir: string) => path.join(dir, "world-config.json");
const versions = (dir: string) => path.join(dir, "versions");
const uploads = (dir: string) => path.join(dir, "uploads");

export async function readConfig(dir = dataDir()): Promise<WorldConfig> {
  try {
    return parseWorldConfig(JSON.parse(await readFile(file(dir), "utf8")));
  } catch {
    return EMPTY_WORLD_CONFIG;
  }
}

async function writeAtomic(target: string, text: string) {
  await mkdir(path.dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, text, "utf8");
  await rename(tmp, target);
}

/** Validates, stamps and saves; the previous config is kept as a version. Returns what was saved. */
export async function saveConfig(input: unknown, dir = dataDir(), now = new Date()): Promise<WorldConfig> {
  const cfg = { ...parseWorldConfig(input), updatedAt: now.toISOString() };
  const prev = await readConfig(dir);
  if (prev.updatedAt) {
    const id = prev.updatedAt.replace(/[:.]/g, "-");
    await writeAtomic(path.join(versions(dir), `${id}.json`), JSON.stringify(prev));
    await pruneVersions(dir);
  }
  await writeAtomic(file(dir), JSON.stringify(cfg, null, 1));
  return cfg;
}

async function pruneVersions(dir: string) {
  const list = await listVersions(dir);
  for (const v of list.slice(KEEP_VERSIONS)) await rm(path.join(versions(dir), `${v.id}.json`), { force: true });
}

const VERSION_ID = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

export async function listVersions(dir = dataDir()): Promise<{ id: string; updatedAt: string }[]> {
  let names: string[] = [];
  try {
    names = await readdir(versions(dir));
  } catch {
    return [];
  }
  return names
    .map((n) => n.replace(/\.json$/, ""))
    .filter((id) => VERSION_ID.test(id))
    .sort()
    .reverse()
    .map((id) => ({ id, updatedAt: id.replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, "T$1:$2:$3.$4Z") }));
}

/** Puts an earlier version back (the current one becomes a version itself). */
export async function restoreVersion(id: string, dir = dataDir(), now = new Date()) {
  if (!VERSION_ID.test(id)) return null;
  try {
    const old = JSON.parse(await readFile(path.join(versions(dir), `${id}.json`), "utf8"));
    return await saveConfig(old, dir, now);
  } catch {
    return null;
  }
}

/** Image type from its first bytes (the declared type is not trusted). */
export function sniffImage(b: Uint8Array): "png" | "jpg" | "webp" | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "webp";
  return null;
}

/** Stores an uploaded image under its content hash; returns its public URL. */
export async function saveUpload(bytes: Uint8Array, dir = dataDir()) {
  if (bytes.length === 0 || bytes.length > MAX_UPLOAD) return { error: "size" as const };
  const ext = sniffImage(bytes);
  if (!ext) return { error: "type" as const };
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = `${hash}.${ext}`;
  const target = path.join(uploads(dir), name);
  try {
    await stat(target);
  } catch {
    await mkdir(uploads(dir), { recursive: true });
    await writeFile(target, bytes);
  }
  return { url: `/api/atom-world/media/${name}` };
}

export const MEDIA_NAME = /^[a-f0-9]{64}\.(png|jpg|webp)$/;
export const MEDIA_TYPE = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" } as const;

export async function readUpload(name: string, dir = dataDir()) {
  if (!MEDIA_NAME.test(name)) return null;
  try {
    return await readFile(path.join(uploads(dir), name));
  } catch {
    return null;
  }
}
