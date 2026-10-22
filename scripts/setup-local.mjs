/**
 * One-time local setup (Windows, macOS or Linux). Run from the project folder:
 *
 *   pnpm install
 *   pnpm setup:local
 *
 * Requires Node.js ≥ 22.12 and a running PostgreSQL server (any user that can create databases).
 * Steps: write .env (asks a few questions, generates AUTH_SECRET) → create the database if it does
 * not exist → apply migrations → build → create the first admin → optionally import catalog.db.
 * Safe to re-run: existing .env, database and admin are kept.
 */
import { spawnSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import pg from "pg";

// Line iterator (works for typed and piped input; readline.question can drop piped lines).
const rl = createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
const ask = async (q, def = "") => {
  process.stdout.write(def ? `${q} [${def}]: ` : `${q}: `);
  const r = await lines.next();
  return ((r.done ? "" : r.value) ?? "").trim() || def;
};
const step = (msg) => console.log(`\n▶ ${msg}`);
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
function run(cmd, args, { optional = false } = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0 && !optional) fail(`Command failed: ${cmd} ${args.join(" ")}`);
  return r.status === 0;
}

/**
 * Fallback when Prisma's migration engine can't be downloaded (it comes from binaries.prisma.sh,
 * which may be unreachable from Iran). Applies each prisma/migrations/<name>/migration.sql in order and
 * records them in _prisma_migrations exactly like Prisma does (checksum = sha256 of the file),
 * so `prisma migrate deploy` keeps working later.
 */
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

// 1. Node version
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 12)) fail(`Node.js ${process.versions.node} is too old. Install Node.js 22 LTS (22.12 or newer) from nodejs.org.`);

// 2. .env
const envPath = path.resolve(".env");
if (existsSync(envPath)) {
  step(".env already exists — keeping it.");
} else {
  step("Creating .env (press Enter to accept the value in brackets)");
  const host = await ask("PostgreSQL host", "localhost");
  const port = await ask("PostgreSQL port", "5432");
  const user = await ask("PostgreSQL user", "postgres");
  const password = await ask("PostgreSQL password (the one chosen when installing PostgreSQL)");
  const dbName = await ask("Database name for the site", "atom");
  const lanIp = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal)?.address;
  console.log(lanIp ? `  Tip: to open the site from phones on the same Wi-Fi (catalog QR codes), use http://${lanIp}:3000` : "");
  const appUrl = await ask("Site address", "http://localhost:3000");
  const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(dbName)}?schema=public`;
  const env = [
    "# Created by pnpm setup:local. Never share or commit this file.",
    `DATABASE_URL="${url}"`,
    `AUTH_SECRET="${randomBytes(32).toString("base64")}"`,
    `APP_URL="${appUrl.replace(/\/+$/, "")}"`,
    'UPLOAD_DIR="./storage/uploads"',
    'PAYMENT_PROVIDER="disabled"',
    'SMS_PROVIDER="log"          # one-time codes are printed in the server window',
    'MAIL_PROVIDER="log"',
    "",
  ].join("\n");
  writeFileSync(envPath, env, { mode: 0o600 });
  console.log("  ✓ .env written");
}
process.loadEnvFile(envPath);

// 3. Database
step("Checking PostgreSQL and the database");
const target = new URL(process.env.DATABASE_URL.split("?")[0]);
const dbName = decodeURIComponent(target.pathname.slice(1));
const adminUrl = new URL(target);
adminUrl.pathname = "/postgres";
const client = new pg.Client({ connectionString: adminUrl.toString() });
try {
  await client.connect();
} catch (e) {
  fail(`Cannot connect to PostgreSQL at ${target.host} (${e.message}). Is PostgreSQL running and the password in .env correct?`);
}
const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
if (exists.rowCount === 0) {
  await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}" ENCODING 'UTF8' TEMPLATE template0`);
  console.log(`  ✓ database "${dbName}" created`);
} else console.log(`  ✓ database "${dbName}" exists`);
await client.end();

// 4. Migrations + build
step("Applying database migrations");
if (!run("pnpm", ["db:deploy"], { optional: true })) {
  console.log("  Prisma migrate is unavailable (often its engine download is blocked). Applying the SQL migrations directly…");
  try {
    await applyMigrationsDirectly(process.env.DATABASE_URL.split("?")[0]);
  } catch (e) {
    fail(`Migration failed: ${e.message}`);
  }
}
step("Building the site (takes a few minutes)");
run("pnpm", ["build"]);

// 5. First admin
const db = new pg.Client({ connectionString: process.env.DATABASE_URL.split("?")[0] });
await db.connect();
const admins = Number((await db.query("SELECT count(*) FROM users WHERE role = 'ADMIN'")).rows[0].count);
const games = Number((await db.query("SELECT count(*) FROM catalog_games")).rows[0].count);
await db.end();
if (admins === 0) {
  step("Create the first admin account");
  rl.pause(); // hand the terminal to the admin script (hidden password input)
  run("pnpm", ["admin:create"]);
  rl.resume();
} else console.log(`\n✓ ${admins} admin account(s) already exist`);

// 6. Optional catalog import
if (games === 0) {
  const file = (await ask("\nPath to the game catalog file (catalog.db), or press Enter to skip", "")).replace(/^"|"$/g, "");
  if (file) {
    if (!existsSync(file)) console.log(`  ! File not found: ${file} (you can import later with: pnpm catalog:import "<path>")`);
    else run("pnpm", ["catalog:import", process.platform === "win32" ? `"${file}"` : file]);
  }
}
rl.close();

const appUrl = readFileSync(envPath, "utf8").match(/^APP_URL="?([^"\n]+)"?/m)?.[1] ?? "http://localhost:3000";
console.log(`\n✓ Setup complete.\n  Start the site:  pnpm start -H 0.0.0.0 -p 3000   (or double-click start-atom.bat on Windows)\n  Open:            ${appUrl}\n  Admin panel:     ${appUrl}/admin\n`);
