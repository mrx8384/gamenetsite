import "server-only";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { type History, type HistoryPoint, type HistoryRange, RANGE_SPEC } from "./ranges";

/** Per-minute samples grouped into buckets (average; CPU also its peak). Times are stored in UTC. */
export async function getHistory(range: HistoryRange): Promise<History> {
  const { seconds, bucket } = RANGE_SPEC[range];
  const [rows, latest] = await Promise.all([
    db.$queryRaw<HistoryPoint[]>`
      SELECT extract(epoch FROM date_bin(make_interval(secs => ${bucket}), "createdAt", TIMESTAMP '2000-01-01'))::float8 * 1000 AS t,
             avg(LEAST(cpu, 100))::float8 AS cpu,
             max(LEAST(cpu, 100))::float8 AS "cpuMax",
             avg("memUsed"::float8 / NULLIF("memTotal", 0) * 100)::float8 AS mem,
             avg(CASE WHEN "swapTotal" > 0 THEN "swapUsed"::float8 / "swapTotal" * 100 ELSE 0 END)::float8 AS swap,
             avg("diskUsed"::float8 / NULLIF("diskTotal", 0) * 100)::float8 AS disk,
             avg(load1)::float8 AS load,
             (sum("netRx")::float8 / NULLIF(sum(seconds), 0))::float8 AS rx,
             (sum("netTx")::float8 / NULLIF(sum(seconds), 0))::float8 AS tx,
             avg("appRss")::float8 AS app
      FROM server_metrics
      WHERE "createdAt" >= (now() AT TIME ZONE 'UTC') - make_interval(secs => ${seconds})
      GROUP BY 1
      ORDER BY 1`,
    db.serverMetric.findFirst({ orderBy: { createdAt: "desc" }, select: { memTotal: true, diskTotal: true } }),
  ]);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    range,
    bucketSec: bucket,
    points: rows.map((r) => ({ t: num(r.t), cpu: num(r.cpu), cpuMax: num(r.cpuMax), mem: num(r.mem), swap: num(r.swap), disk: num(r.disk), load: num(r.load), rx: num(r.rx), tx: num(r.tx), app: num(r.app) })),
    memTotal: Number(latest?.memTotal ?? 0),
    diskTotal: Number(latest?.diskTotal ?? 0),
  };
}

export interface ServerDetails {
  database: { sizeBytes: number; connections: number; latencyMs: number; version: string } | null;
  uploads: { bytes: number; files: number };
  backups: { dir: string; bytes: number; files: number; latestAt: number | null } | null;
}

async function readBackups(): Promise<ServerDetails["backups"]> {
  const dir = process.env.BACKUP_DIR || "/var/backups/atom";
  // Outside the app: tell the bundler not to trace this folder into the build.
  const names = await readdir(/*turbopackIgnore: true*/ dir).catch(() => null);
  if (!names) return null;
  let bytes = 0;
  let files = 0;
  let latestAt: number | null = null;
  for (const name of names) {
    const s = await stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ dir, name)).catch(() => null);
    if (!s?.isFile()) continue;
    bytes += s.size;
    files++;
    if (name.startsWith("db-") && (latestAt === null || s.mtimeMs > latestAt)) latestAt = s.mtimeMs;
  }
  return { dir, bytes, files, latestAt };
}

/** Site-side numbers: database size and health, uploaded files, backups folder. */
export async function getServerDetails(): Promise<ServerDetails> {
  const database = await (async () => {
    try {
      await db.$queryRaw`SELECT 1`; // warm-up: the first query may include opening a connection
      const t0 = performance.now();
      await db.$queryRaw`SELECT 1`;
      const latencyMs = performance.now() - t0;
      const [info] = await db.$queryRaw<{ size: number; connections: number; version: string }[]>`
        SELECT pg_database_size(current_database())::float8 AS size,
               (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
               current_setting('server_version') AS version`;
      return { sizeBytes: info.size, connections: info.connections, latencyMs, version: info.version };
    } catch {
      return null;
    }
  })();
  const [uploads, backups] = await Promise.all([db.media.aggregate({ _sum: { size: true }, _count: true }), readBackups()]);
  return { database, uploads: { bytes: uploads._sum.size ?? 0, files: uploads._count }, backups };
}
