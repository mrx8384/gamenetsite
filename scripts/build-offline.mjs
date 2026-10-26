/**
 * Offline support files (run before `next build`; also fine to run any time):
 *   public/atom-world/offline-manifest.json — every runtime file of the 3D world with its size
 *   public/atom-world/sw.js                — the service worker, stamped with a content version
 * The version changes whenever a file changes, so installed copies update on the next online visit.
 * Usage: node scripts/build-offline.mjs
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pub = join(root, "public");
const dir = join(pub, "atom-world");

// runtime files only (design references, docs and the unused Draco decoder are left out)
const include = [/^envs\/[\w-]+\/.+\.(glb|webp|png|jpg)$/, /^models\/.+\.glb$/, /^textures\/.+\.webp$/, /^photos\/.+\.webp$/, /^references\/characters\/[^/]+\/[^/]+-thumb\.webp$/, /^icons\/.+\.png$/, /^manifest\.webmanifest$/];

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
}

const files = walk(dir)
  .map((f) => relative(dir, f).split("\\").join("/"))
  .filter((r) => include.some((re) => re.test(r)))
  .sort();
const hash = createHash("sha256");
const assets = files.map((r) => {
  const abs = join(dir, r);
  hash.update(r).update(readFileSync(abs));
  return { url: `/atom-world/${r}`, bytes: statSync(abs).size };
});
const template = readFileSync(join(root, "scripts/sw-template.js"), "utf8");
hash.update(template);
const version = hash.digest("hex").slice(0, 12);

writeFileSync(join(dir, "offline-manifest.json"), JSON.stringify({ version, assets }, null, 1) + "\n");
writeFileSync(join(dir, "sw.js"), template.replace("__VERSION__", version).replace("__ASSETS__", JSON.stringify(assets)));
const total = assets.reduce((a, b) => a + b.bytes, 0);
console.log(`offline: ${assets.length} files, ${(total / 1024 / 1024).toFixed(2)} MB, version ${version}`);
