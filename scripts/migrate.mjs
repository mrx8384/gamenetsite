/**
 * Applies database migrations (used by `pnpm db:deploy`).
 * Tries `prisma migrate deploy` first. Prisma's schema engine is downloaded from
 * binaries.prisma.sh, which is unreachable from Iranian servers; in that case each
 * prisma/migrations/<name>/migration.sql is applied directly and recorded in _prisma_migrations
 * exactly like Prisma does (checksum = sha256 of the file), so Prisma stays compatible.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import pg from "pg";

try {
  process.loadEnvFile(".env");
} catch {
  /* use real environment */
}
if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set");
  process.exit(1);
}

async function applyMigrationsDirectly(connectionString) {
  const c = new pg.Client({ connectionString });
  await c.connect();
  try {
    await c.query(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY NOT NULL, "checksum" VARCHAR(64) NOT NULL, "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL, "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0)`);
    const done = new Set((await c.query(`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`)).rows.map((r) => r.migration_name));
    const dir = path.resolve("prisma/migrations");
    for (const name of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
      if (done.has(name)) continue;
      const sql = readFileSync(path.join(dir, name, "migration.sql"));
      await c.query("BEGIN");
      try {
        await c.query(sql.toString("utf8"));
        await c.query(`INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ($1, $2, now(), $3, 1)`, [randomUUID(), createHash("sha256").update(sql).digest("hex"), name]);
        await c.query("COMMIT");
        console.log(`  ✓ ${name}`);
      } catch (e) {
        await c.query("ROLLBACK");
        throw new Error(`${name}: ${e.message}`);
      }
    }
  } finally {
    await c.end();
  }
}

const cli = path.join(path.dirname(createRequire(import.meta.url).resolve("prisma/package.json")), "build", "index.js");
if (spawnSync(process.execPath, [cli, "migrate", "deploy"], { stdio: "inherit" }).status === 0) process.exit(0);

console.log("\nPrisma migrate is unavailable (engine download blocked?). Applying the SQL migrations directly…");
try {
  await applyMigrationsDirectly(process.env.DATABASE_URL.split("?")[0]);
  console.log("✓ Database is up to date");
} catch (e) {
  console.error(`✗ Migration failed: ${e.message}`);
  process.exit(1);
}
