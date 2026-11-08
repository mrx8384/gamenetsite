/**
 * Pure parsers for Linux /proc files and the shared thresholds of Admin → وضعیت سرور.
 * No Node imports, so they are unit-tested with fixture text (tests/unit/server-status.test.ts).
 */

export interface CpuTimes {
  /** All jiffies (user + nice + system + idle + iowait + irq + softirq + steal). */
  total: number;
  /** idle + iowait */
  idle: number;
}

/** /proc/stat → aggregate and per-core CPU times. */
export function parseProcStat(text: string): { all: CpuTimes; cores: CpuTimes[] } | null {
  let all: CpuTimes | null = null;
  const cores: CpuTimes[] = [];
  for (const line of text.split("\n")) {
    const m = /^cpu(\d*)\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    const f = m[2].split(/\s+/).map(Number);
    // guest/guest_nice are already counted in user/nice, so only the first 8 fields are summed.
    const [user = 0, nice = 0, system = 0, idle = 0, iowait = 0, irq = 0, softirq = 0, steal = 0] = f;
    const t = { total: user + nice + system + idle + iowait + irq + softirq + steal, idle: idle + iowait };
    if (m[1] === "") all = t;
    else cores[Number(m[1])] = t;
  }
  return all ? { all, cores: cores.filter(Boolean) } : null;
}

/** Busy share (0–100) between two readings of the same counter. */
export function cpuPercent(a: CpuTimes, b: CpuTimes): number {
  const total = b.total - a.total;
  if (total <= 0) return 0;
  return clampPct(((total - (b.idle - a.idle)) / total) * 100);
}

export interface MemInfo {
  total: number;
  /** What new programs can still use without swapping (MemAvailable). */
  available: number;
  free: number;
  /** Page cache + buffers + reclaimable kernel memory (freed automatically when programs need it). */
  cache: number;
  swapTotal: number;
  swapFree: number;
}

/** /proc/meminfo (values in kB) → bytes. */
export function parseMeminfo(text: string): MemInfo | null {
  const kb = new Map<string, number>();
  for (const line of text.split("\n")) {
    const m = /^(\w+(?:\(\w+\))?):\s+(\d+)/.exec(line);
    if (m) kb.set(m[1], Number(m[2]) * 1024);
  }
  const total = kb.get("MemTotal");
  if (!total) return null;
  const free = kb.get("MemFree") ?? 0;
  const cache = (kb.get("Cached") ?? 0) + (kb.get("Buffers") ?? 0) + (kb.get("SReclaimable") ?? 0) - (kb.get("Shmem") ?? 0);
  // Kernels before 3.14 have no MemAvailable: estimate it the way `free` used to.
  const available = kb.get("MemAvailable") ?? Math.min(total, free + Math.max(0, cache));
  return { total, available, free, cache: Math.max(0, cache), swapTotal: kb.get("SwapTotal") ?? 0, swapFree: kb.get("SwapFree") ?? 0 };
}

// Loopback and virtual interfaces (containers, bridges, VPN tunnels) would count the same traffic twice.
const VIRTUAL_IFACE = /^(lo|veth|docker|br-|virbr|cni|flannel|kube|vnet|tun|tap|wg|tailscale|zt)/;

/** /proc/net/dev → bytes received / sent since boot on the real network interfaces. */
export function parseNetDev(text: string): { rx: number; tx: number } | null {
  let rx = 0;
  let tx = 0;
  let found = false;
  for (const line of text.split("\n")) {
    const m = /^\s*([^:\s]+):\s*(.+)$/.exec(line);
    if (!m || VIRTUAL_IFACE.test(m[1])) continue;
    const f = m[2].trim().split(/\s+/).map(Number);
    if (f.length < 9) continue;
    rx += f[0];
    tx += f[8];
    found = true;
  }
  return found ? { rx, tx } : null;
}

export interface MountEntry {
  device: string;
  mountpoint: string;
  fstype: string;
}

const REAL_FS = new Set(["ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "f2fs", "jfs", "reiserfs", "vfat", "exfat", "ntfs", "ntfs3", "fuseblk", "overlay"]);

/** /proc/self/mounts → real filesystems only, one entry per device (its shortest mount point). */
export function parseMounts(text: string): MountEntry[] {
  const byDevice = new Map<string, MountEntry>();
  for (const line of text.split("\n")) {
    const [device, rawMount, fstype] = line.split(" ");
    if (!device || !rawMount || !REAL_FS.has(fstype)) continue;
    // Spaces etc. in mount points are octal-escaped ("\040").
    const mountpoint = rawMount.replace(/\\([0-7]{3})/g, (_, o: string) => String.fromCharCode(parseInt(o, 8)));
    const prev = byDevice.get(device);
    if (!prev || mountpoint.length < prev.mountpoint.length) byDevice.set(device, { device, mountpoint, fstype });
  }
  return [...byDevice.values()].sort((a, b) => (a.mountpoint === "/" ? -1 : b.mountpoint === "/" ? 1 : a.mountpoint.localeCompare(b.mountpoint)));
}

/** /proc/[pid]/stat → CPU time used by the process (jiffies). */
export function parsePidStat(text: string): { jiffies: number } | null {
  // The command name (field 2) is in parentheses and may itself contain spaces or ")".
  const end = text.lastIndexOf(")");
  if (end < 0) return null;
  const rest = text.slice(end + 2).split(" ");
  const utime = Number(rest[11]);
  const stime = Number(rest[12]);
  return Number.isFinite(utime) && Number.isFinite(stime) ? { jiffies: utime + stime } : null;
}

/** /proc/[pid]/status → process name and resident memory (bytes). Kernel threads have no VmRSS. */
export function parsePidStatus(text: string): { name: string; rss: number } | null {
  const name = /^Name:\s*(.+)$/m.exec(text)?.[1]?.trim();
  const rss = /^VmRSS:\s*(\d+)\s*kB/m.exec(text)?.[1];
  return name && rss ? { name, rss: Number(rss) * 1024 } : null;
}

/** Disk usage the way `df` shows it: used / (used + available to normal users). */
export function diskPercent(used: number, available: number): number {
  return used + available > 0 ? clampPct((used / (used + available)) * 100) : 0;
}

export type Level = "ok" | "high" | "critical";

/** Warning thresholds (percent) for the coloured meters. */
export const THRESHOLDS = { cpu: [75, 90], memory: [80, 90], disk: [80, 90], swap: [50, 80] } as const;

export function levelOf(pct: number, [high, critical]: readonly [number, number]): Level {
  return pct >= critical ? "critical" : pct >= high ? "high" : "ok";
}

export const clampPct = (n: number) => (Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);

/** Friendly names for well-known processes (the kernel truncates names to 15 characters). */
export function processLabel(name: string): string {
  if (name.startsWith("next-server")) return "سایت اتم (Next.js)";
  if (name === "postgres" || name.startsWith("postgres:")) return "دیتابیس (PostgreSQL)";
  if (name === "nginx") return "وب‌سرور (nginx)";
  if (name === "node") return "Node.js";
  if (name === "sshd" || name.startsWith("sshd")) return "SSH";
  if (name.startsWith("fail2ban")) return "fail2ban";
  return name;
}
