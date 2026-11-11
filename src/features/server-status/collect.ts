import "server-only";
import { readdir, readFile, statfs } from "node:fs/promises";
import os from "node:os";
import { cpuPercent, type CpuTimes, diskPercent, type MemInfo, parseMeminfo, parseMounts, parseNetDev, parsePidStat, parsePidStatus, parseProcStat } from "./parse";

/**
 * Reads the server's resources from Linux /proc (the site runs on the server, so it measures itself).
 * Off Linux (local development on another OS) it falls back to Node's `os` module where it can.
 * Only process names and sizes are read — never command lines, which can contain secrets.
 */

const read = (p: string) => readFile(p, "utf8").catch(() => null);

interface ProcSample {
  name: string;
  rss: number;
  jiffies: number;
}

export interface Counters {
  at: number;
  cpu: { all: CpuTimes; cores: CpuTimes[] } | null;
  net: { rx: number; tx: number } | null;
  procs: Map<number, ProcSample> | null;
}

async function readProcesses(): Promise<Map<number, ProcSample> | null> {
  const entries = await readdir("/proc").catch(() => null);
  if (!entries) return null;
  const out = new Map<number, ProcSample>();
  await Promise.all(
    entries
      .filter((e) => /^\d+$/.test(e))
      .map(async (pid) => {
        const [st, status] = await Promise.all([read(`/proc/${pid}/stat`), read(`/proc/${pid}/status`)]);
        const s = st ? parsePidStat(st) : null;
        const info = status ? parsePidStatus(status) : null;
        if (s && info) out.set(Number(pid), { ...info, jiffies: s.jiffies });
      }),
  );
  return out;
}

/** CPU times from Node when /proc is missing (development off Linux); same shape, milliseconds. */
function cpuFromOs(): { all: CpuTimes; cores: CpuTimes[] } | null {
  const cores = os.cpus().map(({ times: t }) => ({ total: t.user + t.nice + t.sys + t.idle + t.irq, idle: t.idle }));
  if (!cores.length) return null;
  return { all: cores.reduce((a, c) => ({ total: a.total + c.total, idle: a.idle + c.idle }), { total: 0, idle: 0 }), cores };
}

export async function readCounters(withProcesses: boolean): Promise<Counters> {
  const [stat, net, procs] = await Promise.all([read("/proc/stat"), read("/proc/net/dev"), withProcesses ? readProcesses() : Promise.resolve(null)]);
  return { at: Date.now(), cpu: (stat ? parseProcStat(stat) : null) ?? cpuFromOs(), net: net ? parseNetDev(net) : null, procs };
}

export async function readMemory(): Promise<MemInfo> {
  const text = await read("/proc/meminfo");
  const parsed = text ? parseMeminfo(text) : null;
  if (parsed) return parsed;
  const total = os.totalmem();
  const free = os.freemem();
  return { total, available: free, free, cache: 0, swapTotal: 0, swapFree: 0 };
}

export interface DiskInfo {
  mount: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}

async function diskAt(mount: string, fstype: string): Promise<DiskInfo | null> {
  const s = await statfs(mount).catch(() => null);
  if (!s || !s.blocks) return null;
  const total = s.blocks * s.bsize;
  const used = (s.blocks - s.bfree) * s.bsize;
  const free = s.bavail * s.bsize;
  return { mount, fstype, total, used, free, percent: diskPercent(used, free) };
}

export async function readDisks(): Promise<DiskInfo[]> {
  const text = await read("/proc/self/mounts");
  const mounts = text ? parseMounts(text) : [];
  const disks = (await Promise.all(mounts.map((m) => diskAt(m.mountpoint, m.fstype)))).filter((d): d is DiskInfo => !!d);
  // The same filesystem can appear under several devices (bind mounts): keep one per size/usage pair.
  const seen = new Set<string>();
  const unique = disks.filter((d) => {
    const key = `${d.total}:${d.used}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length) return unique;
  const root = await diskAt("/", "");
  return root ? [root] : [];
}

/** The root filesystem (stored in the history). */
export async function readRootDisk(): Promise<DiskInfo | null> {
  return diskAt("/", "");
}


export interface LiveSnapshot {
  takenAt: number;
  host: { cores: number };
  cpu: { percent: number | null; cores: number[]; load: [number, number, number] };
  memory: { total: number; used: number; available: number; cache: number; free: number; swapTotal: number; swapUsed: number };
  disks: DiskInfo[];
  network: { rxRate: number; txRate: number; rxTotal: number; txTotal: number } | null;
  processes: { name: string; count: number; rss: number; cpu: number | null }[];
  app: { rss: number; heapUsed: number; uptimeSec: number };
}

// Live readings are measured against the previous request (one admin tab polls every few seconds);
// without a usable previous reading, two readings are taken a short moment apart.
let lastLive: Counters | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  let cur = await readCounters(true);
  let prev = lastLive;
  if (!prev || cur.at - prev.at < 1500 || cur.at - prev.at > 60_000) {
    prev = cur;
    await sleep(700);
    cur = await readCounters(true);
  }
  lastLive = cur;
  const seconds = Math.max(0.001, (cur.at - prev.at) / 1000);
  const [mem, disks] = await Promise.all([readMemory(), readDisks()]);
  const cpus = os.cpus();

  const cpu = cur.cpu && prev.cpu ? { percent: cpuPercent(prev.cpu.all, cur.cpu.all), cores: cur.cpu.cores.map((c, i) => (prev.cpu!.cores[i] ? cpuPercent(prev.cpu!.cores[i], c) : 0)) } : { percent: null, cores: [] };

  const network =
    cur.net && prev.net
      ? { rxRate: Math.max(0, cur.net.rx - prev.net.rx) / seconds, txRate: Math.max(0, cur.net.tx - prev.net.tx) / seconds, rxTotal: cur.net.rx, txTotal: cur.net.tx }
      : null;

  // Processes grouped by name (postgres runs as many processes), biggest memory users first.
  const totalJiffies = cur.cpu && prev.cpu ? cur.cpu.all.total - prev.cpu.all.total : 0;
  const groups = new Map<string, { name: string; count: number; rss: number; jiffies: number }>();
  for (const [pid, p] of cur.procs ?? []) {
    const g = groups.get(p.name) ?? { name: p.name, count: 0, rss: 0, jiffies: 0 };
    g.count++;
    g.rss += p.rss;
    const before = prev.procs?.get(pid);
    if (before && before.name === p.name) g.jiffies += Math.max(0, p.jiffies - before.jiffies);
    groups.set(p.name, g);
  }
  const processes = [...groups.values()]
    .sort((a, b) => b.rss - a.rss)
    .slice(0, 8)
    .map((g) => ({ name: g.name, count: g.count, rss: g.rss, cpu: totalJiffies > 0 ? Math.min(100, (g.jiffies / totalJiffies) * 100) : null }));

  const usage = process.memoryUsage();
  return {
    takenAt: cur.at,
    host: { cores: cpus.length || 1 },
    cpu: { ...cpu, load: os.loadavg() as [number, number, number] },
    memory: { total: mem.total, used: Math.max(0, mem.total - mem.available), available: mem.available, cache: mem.cache, free: mem.free, swapTotal: mem.swapTotal, swapUsed: Math.max(0, mem.swapTotal - mem.swapFree) },
    disks,
    network,
    processes,
    app: { rss: usage.rss, heapUsed: usage.heapUsed, uptimeSec: process.uptime() },
  };
}
