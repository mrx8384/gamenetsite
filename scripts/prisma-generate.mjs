/**
 * Runs `prisma generate`, also where binaries.prisma.sh is unreachable (e.g. from Iran).
 * Generating the client does not need Prisma's schema engine, but the CLI still tries to download
 * it when missing; if that fails we retry with PRISMA_SCHEMA_ENGINE_BINARY pointing to a
 * placeholder file so the download is skipped. Migrations without the engine are handled by
 * `pnpm setup:local` (direct SQL fallback).
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

const cli = path.join(path.dirname(createRequire(import.meta.url).resolve("prisma/package.json")), "build", "index.js");
const generate = (env = {}) => spawnSync(process.execPath, [cli, "generate"], { stdio: "inherit", env: { ...process.env, ...env } }).status === 0;

if (generate()) process.exit(0);

console.log("\nPrisma engine download failed — generating the client without it…");
const placeholder = path.join(tmpdir(), "prisma-schema-engine-placeholder");
writeFileSync(placeholder, "");
if (generate({ PRISMA_SCHEMA_ENGINE_BINARY: placeholder })) process.exit(0);

console.error("\n✗ Could not generate the Prisma client. Check the error above.");
process.exit(1);
