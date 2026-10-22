/**
 * Imports the original catalog.db into the site, REPLACING the current catalog.
 * The source file is opened read-only and never modified.
 *
 *   pnpm catalog:import /path/to/catalog.db
 */
import path from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  /* use real environment */
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: pnpm catalog:import /path/to/catalog.db");
  const { importCatalogDatabase } = await import("../src/features/game-catalog/importer");
  const started = Date.now();
  const s = await importCatalogDatabase(path.resolve(file), { fileName: path.basename(file), actorId: null });
  console.log(`✓ Imported in ${((Date.now() - started) / 1000).toFixed(1)}s (schema v${s.schemaVersion}, sha256 ${s.sourceSha256.slice(0, 16)}…)`);
  console.log(`  PS4: ${s.games.PS4} games · PS5: ${s.games.PS5} games · ${s.categories} categories`);
  if (s.renamedIds) console.log(`  ${s.renamedIds} invalid/duplicate IDs were regenerated`);
  for (const k of s.skipped) console.log(`  skipped ${k.id} «${k.name}»: ${k.reason}`);
  console.log("  Note: restart the site or edit anything in the catalog admin to refresh cached pages.");
  const { db } = await import("../src/lib/db");
  await db.$disconnect();
}

main().catch((e: unknown) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
