import { describe, expect, it } from "vitest";
import { nearestIndex, niceByteTicks, niceTicks, segments } from "@/features/server-status/chart-math";
import { formatBytes, formatBytesShort, formatDuration, formatPct } from "@/features/server-status/format";
import { cpuPercent, diskPercent, levelOf, parseMeminfo, parseMounts, parseNetDev, parsePidStat, parsePidStatus, parseProcStat, processLabel, THRESHOLDS } from "@/features/server-status/parse";
import { isHistoryRange, RANGE_SPEC } from "@/features/server-status/ranges";

const STAT_A = `cpu  100 0 50 800 50 0 0 0 0 0
cpu0 60 0 30 390 20 0 0 0 0 0
cpu1 40 0 20 410 30 0 0 0 0 0
intr 12345
ctxt 999`;
const STAT_B = `cpu  160 0 70 860 60 0 0 0 0 0
cpu0 110 0 40 400 25 0 0 0 0 0
cpu1 50 0 30 460 35 0 0 0 0 0`;

describe("/proc parsers", () => {
  it("CPU usage between two readings (all cores and each core)", () => {
    const a = parseProcStat(STAT_A)!;
    const b = parseProcStat(STAT_B)!;
    expect(a.cores).toHaveLength(2);
    // total +150, idle(+iowait) +70 → busy 80/150
    expect(cpuPercent(a.all, b.all)).toBeCloseTo(53.33, 1);
    expect(cpuPercent(a.cores[0], b.cores[0])).toBeCloseTo(((50 + 10) / 75) * 100, 5);
    expect(cpuPercent(b.all, b.all)).toBe(0);
    expect(parseProcStat("nothing here")).toBeNull();
  });

  it("memory: used = total − available; cache and swap", () => {
    const m = parseMeminfo(`MemTotal:        4000000 kB
MemFree:          500000 kB
MemAvailable:    2500000 kB
Buffers:          100000 kB
Cached:          1500000 kB
SwapCached:            0 kB
Active(anon):     900000 kB
Shmem:             50000 kB
SReclaimable:     150000 kB
SwapTotal:       2097148 kB
SwapFree:        2000000 kB`)!;
    expect(m.total).toBe(4_000_000 * 1024);
    expect(m.available).toBe(2_500_000 * 1024);
    expect(m.cache).toBe((1_500_000 + 100_000 + 150_000 - 50_000) * 1024);
    expect(m.swapTotal - m.swapFree).toBe(97_148 * 1024);
    // Old kernels without MemAvailable
    expect(parseMeminfo("MemTotal: 1000 kB\nMemFree: 200 kB\nCached: 300 kB\nBuffers: 100 kB")!.available).toBe(600 * 1024);
  });

  it("network counts real interfaces only", () => {
    const text = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 9999999   100    0    0    0     0          0         0  9999999   100    0    0    0     0       0          0
  eth0: 1000      10    0    0    0     0          0         0     2000      20    0    0    0     0       0          0
  ens4: 500       5     0    0    0     0          0         0      700       7    0    0    0     0       0          0
docker0: 88888    1     0    0    0     0          0         0    88888       1    0    0    0     0       0          0
vethab12: 77777   1     0    0    0     0          0         0    77777       1    0    0    0     0       0          0`;
    expect(parseNetDev(text)).toEqual({ rx: 1500, tx: 2700 });
    expect(parseNetDev("Inter-| x\n face | y\n    lo: 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16")).toBeNull();
  });

  it("mounts: real filesystems, one per device, root first, escaped spaces", () => {
    const text = `/dev/vda1 / ext4 rw,relatime 0 0
proc /proc proc rw 0 0
tmpfs /run tmpfs rw 0 0
/dev/vda1 /usr ext4 ro,relatime 0 0
/dev/vdb1 /mnt/my\\040data xfs rw 0 0
/dev/loop0 /snap/core squashfs ro 0 0
/dev/vda15 /boot/efi vfat rw 0 0`;
    expect(parseMounts(text)).toEqual([
      { device: "/dev/vda1", mountpoint: "/", fstype: "ext4" },
      { device: "/dev/vda15", mountpoint: "/boot/efi", fstype: "vfat" },
      { device: "/dev/vdb1", mountpoint: "/mnt/my data", fstype: "xfs" },
    ]);
  });

  it("process stat and status (names with spaces and parentheses)", () => {
    const stat = "1234 (my (odd) proc) S 1 1234 1234 0 -1 4194560 500 0 0 0 70 30 0 0 20 0 4 0 100 1000000 250 18446744073709551615";
    expect(parsePidStat(stat)).toEqual({ jiffies: 100 });
    expect(parsePidStatus("Name:\tpostgres\nUmask:\t0077\nState:\tS (sleeping)\nVmRSS:\t   20480 kB\n")).toEqual({ name: "postgres", rss: 20480 * 1024 });
    expect(parsePidStatus("Name:\tkworker/0:1\nState:\tI (idle)\n")).toBeNull(); // kernel thread
  });

  it("disk percent like df, levels and labels", () => {
    expect(diskPercent(80, 20)).toBe(80);
    expect(diskPercent(0, 0)).toBe(0);
    expect(levelOf(79.9, THRESHOLDS.disk)).toBe("ok");
    expect(levelOf(80, THRESHOLDS.disk)).toBe("high");
    expect(levelOf(95, THRESHOLDS.disk)).toBe("critical");
    expect(processLabel("next-server (v1")).toBe("سایت اتم (Next.js)");
    expect(processLabel("postgres")).toBe("دیتابیس (PostgreSQL)");
    expect(processLabel("redis-server")).toBe("redis-server");
  });
});

describe("chart helpers", () => {
  it("nice axis ticks", () => {
    expect(niceTicks(100)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceByteTicks(3 * 1024 * 1024)).toEqual([0, 1, 2, 3].map((v) => v * 1024 * 1024));
    expect(niceByteTicks(900)).toEqual([0, 250, 500, 750, 1000]);
  });

  it("lines break at missing values and time gaps", () => {
    const t = [0, 60, 120, 600, 660, 720];
    expect(segments(t, [1, 2, null, 4, 5, 6], 150)).toEqual([[0, 1], [3, 4, 5]]);
    expect(segments(t, [1, 2, 3, 4, 5, 6], 150)).toEqual([[0, 1, 2], [3, 4, 5]]);
    expect(segments([], [], 10)).toEqual([]);
  });

  it("nearest point to a time", () => {
    const t = [0, 10, 20, 30];
    expect(nearestIndex(t, -5)).toBe(0);
    expect(nearestIndex(t, 14)).toBe(1);
    expect(nearestIndex(t, 16)).toBe(2);
    expect(nearestIndex(t, 99)).toBe(3);
    expect(nearestIndex([], 1)).toBe(-1);
  });
});

describe("format and ranges", () => {
  it("Persian sizes, rates, percentages and durations", () => {
    expect(formatBytes(0)).toBe("۰ بایت");
    expect(formatBytes(1536)).toBe("۱٫۵ کیلوبایت");
    expect(formatBytes(3.2 * 1024 ** 3)).toBe("۳٫۲ گیگابایت");
    expect(formatBytesShort(150 * 1024, "/s")).toBe("۱۵۰ KB/s");
    expect(formatPct(42.6)).toBe("۴۳٪");
    expect(formatDuration(3 * 86_400 + 4 * 3600 + 120)).toBe("۳ روز و ۴ ساعت");
    expect(formatDuration(5 * 3600 + 12 * 60)).toBe("۵ ساعت و ۱۲ دقیقه");
    expect(formatDuration(30)).toBe("۱ دقیقه");
  });
  it("history ranges keep charts at a few hundred points", () => {
    for (const r of Object.values(RANGE_SPEC)) expect(r.seconds / r.bucket).toBeLessThanOrEqual(400);
    expect(isHistoryRange("7d")).toBe(true);
    expect(isHistoryRange("1y")).toBe(false);
  });
});
