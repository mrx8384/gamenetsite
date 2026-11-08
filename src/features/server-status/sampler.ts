import "server-only";
import os from "node:os";
import { db } from "@/lib/db";
import { type Counters, readCounters, readMemory, readRootDisk } from "./collect";
import { cpuPercent } from "./parse";

/**
 * Stores one ServerMetric row per minute for the history charts. Started once per server process from
 * src/instrumentation.ts; the timer never keeps a process alive (unref) and failures (database
 * restarting, …) are logged once and retried on the next tick.
 */
const INTERVAL_MS = 60_000;
const KEY = Symbol.for("atom.serverMetricsSampler");

export function startServerMetricsSampler(): void {
  const g = globalThis as unknown as Record<symbol, ReturnType<typeof setInterval> | undefined>;
  if (g[KEY]) return;
  let prev: Counters | null = null;
  let failing = false;

  const tick = async () => {
    const cur = await readCounters(false);
    const before = prev;
    prev = cur;
    if (!before) return; // first reading is the baseline
    const seconds = Math.round((cur.at - before.at) / 1000);
    if (seconds < 20) return;
    // Another server process (if ever more than one runs) already sampled this minute.
    if (await db.serverMetric.findFirst({ where: { createdAt: { gt: new Date(Date.now() - 40_000) } }, select: { id: true } })) return;
    const [mem, disk] = await Promise.all([readMemory(), readRootDisk()]);
    const delta = (a?: number, b?: number) => BigInt(a !== undefined && b !== undefined ? Math.max(0, b - a) : 0);
    await db.serverMetric.create({
      data: {
        createdAt: new Date(cur.at),
        seconds,
        cpu: before.cpu && cur.cpu ? cpuPercent(before.cpu.all, cur.cpu.all) : 0,
        load1: os.loadavg()[0],
        memUsed: BigInt(Math.max(0, mem.total - mem.available)),
        memTotal: BigInt(mem.total),
        swapUsed: BigInt(Math.max(0, mem.swapTotal - mem.swapFree)),
        swapTotal: BigInt(mem.swapTotal),
        diskUsed: BigInt(disk?.used ?? 0),
        diskTotal: BigInt(disk ? disk.used + disk.free : 0),
        netRx: delta(before.net?.rx, cur.net?.rx),
        netTx: delta(before.net?.tx, cur.net?.tx),
        appRss: BigInt(process.memoryUsage().rss),
      },
    });
  };

  const run = () =>
    tick().then(
      () => {
        failing = false;
      },
      (e: unknown) => {
        if (!failing) console.error("[server-metrics] sampling failed (will retry every minute):", e instanceof Error ? e.message : e);
        failing = true;
      },
    );
  void run();
  const timer = setInterval(run, INTERVAL_MS);
  timer.unref?.();
  g[KEY] = timer;
}
