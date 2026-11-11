"use client";

import * as React from "react";
import { Activity, AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Cpu, Database, HardDrive, MemoryStick, Network, OctagonAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LiveSnapshot } from "@/features/server-status/collect";
import { niceByteTicks } from "@/features/server-status/chart-math";
import { formatBytes, formatBytesShort, formatClockSeconds, formatDuration, formatMoment, formatNum1, formatPct, formatRate } from "@/features/server-status/format";
import { clampPct, type Level, levelOf, processLabel, THRESHOLDS } from "@/features/server-status/parse";
import type { ServerDetails } from "@/features/server-status/queries";
import { type History, HISTORY_RANGES, type HistoryRange, RANGE_SPEC } from "@/features/server-status/ranges";
import { cn } from "@/lib/utils";
import { Sparkline, TimeChart } from "./charts";

const LIVE_MS = 5000;
const BUFFER = 60; // 5 minutes of live points for the sparklines

interface LivePoint {
  t: number;
  cpu: number;
  mem: number;
  /** Download + upload, bytes per second (same figure as the network tile's value). */
  net: number;
}
const toPoint = (s: LiveSnapshot): LivePoint => ({ t: s.takenAt, cpu: s.cpu.percent ?? 0, mem: s.memory.total ? (s.memory.used / s.memory.total) * 100 : 0, net: s.network ? s.network.rxRate + s.network.txRate : 0 });

async function getJson<T>(url: string): Promise<T | "forbidden" | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (r.status === 403) return "forbidden";
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export function ServerDashboard({ initial }: { initial: { live: LiveSnapshot; details: ServerDetails; history: History; fetchedAt: number } }) {
  const [live, setLive] = React.useState(initial.live);
  const [buffer, setBuffer] = React.useState<LivePoint[]>(() => [toPoint(initial.live)]);
  const [details, setDetails] = React.useState(initial.details);
  const [state, setState] = React.useState<"ok" | "error" | "forbidden">("ok");

  // Live readings every 5 s while the tab is visible (stops when the session ended).
  React.useEffect(() => {
    if (state === "forbidden") return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (document.visibilityState === "visible") {
        const data = await getJson<LiveSnapshot>("/api/admin/server?part=live");
        if (stop) return;
        if (data === "forbidden") return setState("forbidden");
        if (data) {
          setLive(data);
          setBuffer((b) => [...b.slice(-(BUFFER - 1)), toPoint(data)]);
          setState("ok");
        } else setState("error");
      }
      if (!stop) timer = setTimeout(loop, LIVE_MS);
    };
    timer = setTimeout(loop, LIVE_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [state]);

  // Database, uploads and backups change slowly: once a minute.
  React.useEffect(() => {
    if (state === "forbidden") return;
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const data = await getJson<ServerDetails>("/api/admin/server?part=details");
      if (data && data !== "forbidden") setDetails(data);
    }, 60_000);
    return () => clearInterval(id);
  }, [state]);

  const mem = live.memory;
  const memPct = mem.total ? (mem.used / mem.total) * 100 : 0;
  const root = live.disks.find((d) => d.mount === "/") ?? live.disks[0];

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-1.5 text-xs" role="status">
        {state === "forbidden" ? (
          <span className="font-semibold text-destructive">نشست شما تمام شده؛ صفحه را دوباره باز کنید.</span>
        ) : state === "error" ? (
          <span className="font-semibold text-warning">ارتباط با سرور برقرار نشد؛ دوباره تلاش می‌شود…</span>
        ) : (
          <>
            <span className="size-2 animate-pulse rounded-full bg-brand-green" aria-hidden />
            <span className="text-muted-foreground">زنده · هر ۵ ثانیه · {formatClockSeconds(live.takenAt)}</span>
          </>
        )}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Cpu} label="پردازنده (CPU)" value={live.cpu.percent === null ? "—" : formatPct(live.cpu.percent)} pct={live.cpu.percent ?? undefined} thresholds={THRESHOLDS.cpu} sub={`${formatNum1(live.host.cores)} هسته · بار سیستم ${formatNum1(live.cpu.load[0])}`} spark={buffer.map((p) => p.cpu)} sparkMax={100} />
        <StatTile icon={MemoryStick} label="حافظهٔ رم (RAM)" value={formatPct(memPct)} pct={memPct} thresholds={THRESHOLDS.memory} sub={`${formatBytes(mem.used)} از ${formatBytes(mem.total)} · آزاد ${formatBytes(mem.available)}`} spark={buffer.map((p) => p.mem)} sparkMax={100} />
        {root ? (
          <StatTile icon={HardDrive} label="فضای دیسک" value={formatPct(root.percent)} pct={root.percent} thresholds={THRESHOLDS.disk} sub={`${formatBytes(root.used)} از ${formatBytes(root.used + root.free)} · خالی ${formatBytes(root.free)}`} />
        ) : (
          <StatTile icon={HardDrive} label="فضای دیسک" value="—" sub="خوانده نشد" />
        )}
        <StatTile
          icon={Network}
          label="شبکه (اینترنت سرور)"
          value={live.network ? formatBytesShort(live.network.rxRate + live.network.txRate, "/s") : "—"}
          sub={live.network ? `دریافت ${formatRate(live.network.rxRate)} · ارسال ${formatRate(live.network.txRate)}` : "خوانده نشد"}
          spark={buffer.map((p) => p.net)}
          valueLtr
        >
          {live.network ? (
            <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ArrowDown className="size-3" aria-hidden /> از روشن شدن: {formatBytes(live.network.rxTotal)}</span>
              <span className="flex items-center gap-1"><ArrowUp className="size-3" aria-hidden /> {formatBytes(live.network.txTotal)}</span>
            </p>
          ) : null}
        </StatTile>
      </div>

      <HistorySection initial={initial.history} fetchedAt={initial.fetchedAt} paused={state === "forbidden"} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Cpu className="size-4" aria-hidden /> هسته‌های پردازنده</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {live.cpu.cores.map((c, i) => (
                <li key={i} className="space-y-1">
                  <p className="flex justify-between text-xs"><span className="text-muted-foreground">هستهٔ {formatNum1(i + 1)}</span><span className="font-semibold tabular-nums">{formatPct(c)}</span></p>
                  <Meter pct={c} level={levelOf(c, THRESHOLDS.cpu)} thin />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              بار سیستم (میانگین ۱ / ۵ / ۱۵ دقیقه): <span className="font-semibold text-foreground tabular-nums">{live.cpu.load.map(formatNum1).join(" / ")}</span> — اگر بیشتر از تعداد هسته‌ها ({formatNum1(live.host.cores)}) بماند، سرور زیر فشار است.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MemoryStick className="size-4" aria-hidden /> جزئیات رم</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Row label="کل رم" value={formatBytes(mem.total)} />
              <Row label="در حال استفادهٔ برنامه‌ها" value={formatBytes(mem.used)} />
              <Row label="کش (خودکار آزاد می‌شود)" value={formatBytes(mem.cache)} />
              <Row label="قابل استفاده" value={formatBytes(mem.available)} />
            </dl>
            <div className="space-y-1">
              <p className="flex justify-between text-xs">
                <span className="text-muted-foreground">حافظهٔ مجازی (Swap)</span>
                <span className="font-semibold">{mem.swapTotal ? `${formatBytes(mem.swapUsed)} از ${formatBytes(mem.swapTotal)}` : "ندارد"}</span>
              </p>
              {mem.swapTotal ? <Meter pct={(mem.swapUsed / mem.swapTotal) * 100} level={levelOf((mem.swapUsed / mem.swapTotal) * 100, THRESHOLDS.swap)} thin /> : null}
            </div>
            <p className="text-xs leading-6 text-muted-foreground">لینوکس رمِ بی‌کار را برای کش فایل‌ها استفاده می‌کند تا سایت سریع‌تر باشد؛ این بخش هر وقت لازم شود آزاد می‌شود و جزو «در حال استفاده» حساب نمی‌شود.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><HardDrive className="size-4" aria-hidden /> دیسک‌ها</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {live.disks.length === 0 ? <p className="text-sm text-muted-foreground">اطلاعات دیسک خوانده نشد.</p> : null}
            {live.disks.map((d) => (
              <div key={d.mount} className="space-y-1">
                <p className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="ltr font-mono font-semibold">{d.mount}</span>
                  <span className="text-muted-foreground">{formatBytes(d.used)} از {formatBytes(d.used + d.free)} · خالی {formatBytes(d.free)} · <span className="font-semibold text-foreground">{formatPct(d.percent)}</span></span>
                </p>
                <Meter pct={d.percent} level={levelOf(d.percent, THRESHOLDS.disk)} />
              </div>
            ))}
            <dl className="grid grid-cols-1 gap-y-1.5 border-t pt-3 text-xs sm:grid-cols-2 sm:gap-x-4">
              <Row label="عکس‌های آپلودشده" value={`${formatBytes(details.uploads.bytes)} (${formatNum1(details.uploads.files)} فایل)`} />
              <Row label="دیتابیس" value={details.database ? formatBytes(details.database.sizeBytes) : "—"} />
              <Row label="پشتیبان‌ها" value={details.backups ? `${formatBytes(details.backups.bytes)} (${formatNum1(details.backups.files)} فایل)` : "خوانده نشد"} />
              <Row label="آخرین پشتیبان دیتابیس" value={details.backups?.latestAt ? formatMoment(details.backups.latestAt) : "—"} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Activity className="size-4" aria-hidden /> پرمصرف‌ترین برنامه‌ها</CardTitle></CardHeader>
          <CardContent>
            {live.processes.length === 0 ? (
              <p className="text-sm text-muted-foreground">فهرست برنامه‌ها در دسترس نیست.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 text-start font-medium">برنامه</th>
                      <th className="py-2 text-start font-medium">رم</th>
                      <th className="py-2 text-start font-medium">CPU</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {live.processes.map((p) => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="py-2">
                          <span className="font-medium">{processLabel(p.name)}</span>
                          {p.count > 1 ? <span className="ms-1 text-xs text-muted-foreground">× {formatNum1(p.count)}</span> : null}
                        </td>
                        <td className="py-2">{formatBytes(p.rss)}</td>
                        <td className="py-2">{p.cpu === null ? "—" : formatPct(p.cpu)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Database className="size-4" aria-hidden /> سایت و دیتابیس</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <Row label="رم مصرفی سایت" value={formatBytes(live.app.rss)} />
              <Row label="سایت روشن از" value={`${formatDuration(live.app.uptimeSec)} پیش`} />
              <Row label="پاسخ دیتابیس" value={details.database ? `${formatNum1(Math.round(details.database.latencyMs * 10) / 10)} میلی‌ثانیه` : "در دسترس نیست"} />
              <Row label="اتصال‌های دیتابیس" value={details.database ? formatNum1(details.database.connections) : "—"} />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold", ltr && "ltr")}>{value}</dd>
    </div>
  );
}

const LEVEL_UI: Record<Level, { label: string; icon: typeof CheckCircle2; text: string; fill: string; track: string }> = {
  ok: { label: "عادی", icon: CheckCircle2, text: "text-success", fill: "var(--chart-ok)", track: "var(--success-soft)" },
  high: { label: "زیاد", icon: AlertTriangle, text: "text-warning", fill: "var(--chart-high)", track: "var(--warning-soft)" },
  critical: { label: "بحرانی", icon: OctagonAlert, text: "text-destructive", fill: "var(--chart-critical)", track: "var(--destructive-soft)" },
};

/** A ratio against its limit; the fill colour carries the level, always next to a text label. */
function Meter({ pct, level, thin = false }: { pct: number; level: Level; thin?: boolean }) {
  const ui = LEVEL_UI[level];
  const v = clampPct(pct);
  return (
    <div className={cn("w-full overflow-hidden rounded-full", thin ? "h-1.5" : "h-2.5")} style={{ background: ui.track }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={`${formatPct(v)} — ${ui.label}`}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${v}%`, background: ui.fill }} />
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  pct,
  thresholds,
  spark,
  sparkMax,
  valueLtr = false,
  children,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  sub: string;
  pct?: number;
  thresholds?: readonly [number, number];
  spark?: number[];
  sparkMax?: number;
  /** The value has a Latin unit ("12 KB/s"): keep it left-to-right on one line. */
  valueLtr?: boolean;
  children?: React.ReactNode;
}) {
  const level = pct !== undefined && thresholds ? levelOf(pct, thresholds) : null;
  const ui = level ? LEVEL_UI[level] : null;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><Icon className="size-4" aria-hidden /> {label}</p>
        {ui ? (
          <span className={cn("flex items-center gap-1 text-xs font-bold", ui.text)}>
            <ui.icon className="size-3.5" aria-hidden /> {ui.label}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="shrink-0 text-3xl font-bold whitespace-nowrap" dir={valueLtr ? "ltr" : undefined}>{value}</p>
        {spark ? (
          <div className="flex min-w-0 flex-1 justify-end">
            <Sparkline values={spark} max={sparkMax} />
          </div>
        ) : null}
      </div>
      {pct !== undefined && level ? <Meter pct={pct} level={level} /> : null}
      <p className="text-xs leading-5 text-muted-foreground">{sub}</p>
      {children}
    </Card>
  );
}

function HistorySection({ initial, fetchedAt, paused }: { initial: History; fetchedAt: number; paused: boolean }) {
  const [range, setRange] = React.useState<HistoryRange>(initial.range);
  const [data, setData] = React.useState({ history: initial, at: fetchedAt });
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async (r: HistoryRange) => {
    setLoading(true);
    const res = await getJson<History>(`/api/admin/server?part=history&range=${r}`);
    if (res && res !== "forbidden") setData({ history: res, at: Date.now() });
    setLoading(false);
  }, []);

  // New samples arrive once a minute.
  React.useEffect(() => {
    if (paused) return;
    const id = setInterval(() => document.visibilityState === "visible" && void load(range), 60_000);
    return () => clearInterval(id);
  }, [paused, range, load]);

  const h = data.history;
  const spec = RANGE_SPEC[h.range];
  const times = h.points.map((p) => p.t);
  const domain: [number, number] = [data.at - spec.seconds * 1000, data.at];
  const gapMs = h.bucketSec * 1000 * 2.5;
  const days = spec.seconds > 86_400;
  const stats = (vals: number[]) => (vals.length ? { avg: vals.reduce((a, b) => a + b, 0) / vals.length, max: Math.max(...vals) } : null);
  const cpu = stats(h.points.map((p) => p.cpuMax));
  const memS = stats(h.points.map((p) => p.mem));
  const disk = h.points.length ? h.points[h.points.length - 1].disk : null;
  const rx = stats(h.points.map((p) => p.rx));
  const pctAxis = (v: number) => formatPct(v);
  const empty = "هنوز داده‌ای ثبت نشده است. سایت هر دقیقه یک نمونه ثبت می‌کند؛ چند دقیقه بعد دوباره نگاه کنید.";

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="text-base">نمودار مصرف در گذشته</CardTitle>
        <div className="flex flex-wrap gap-2" role="group" aria-label="بازهٔ زمانی">
          {HISTORY_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => {
                setRange(r);
                void load(r);
              }}
              className={cn("cursor-pointer rounded-lg border px-3 py-1 text-xs font-semibold transition-colors", range === r ? "border-brand-green bg-primary text-primary-foreground" : "bg-surface hover:bg-secondary")}
            >
              {RANGE_SPEC[r].label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TimeChart
          title="پردازنده (CPU)"
          summary={cpu ? `میانگین ${formatPct(stats(h.points.map((p) => p.cpu))!.avg)} · بیشترین ${formatPct(cpu.max)}` : undefined}
          times={times}
          series={[{ key: "cpu", label: "مصرف CPU", color: "var(--chart-1)", values: h.points.map((p) => p.cpu) }]}
          extra={(i) => [{ label: "بیشترین در این بازه", value: formatPct(h.points[i].cpuMax) }, { label: "بار سیستم", value: formatNum1(h.points[i].load) }]}
          domain={domain}
          gapMs={gapMs}
          yMax={100}
          formatAxis={pctAxis}
          formatValue={formatPct}
          dayTicks={days}
          dim={loading}
          emptyText={empty}
        />
        <TimeChart
          title="حافظهٔ رم (RAM)"
          summary={memS && h.memTotal ? `میانگین ${formatPct(memS.avg)} · بیشترین ${formatPct(memS.max)} · کل رم ${formatBytes(h.memTotal)}` : undefined}
          times={times}
          series={[{ key: "mem", label: "مصرف رم", color: "var(--chart-1)", values: h.points.map((p) => p.mem) }]}
          extra={(i) => [{ label: "رم سایت", value: formatBytes(h.points[i].app) }, ...(h.points[i].swap > 0 ? [{ label: "Swap", value: formatPct(h.points[i].swap) }] : [])]}
          domain={domain}
          gapMs={gapMs}
          yMax={100}
          formatAxis={pctAxis}
          formatValue={formatPct}
          dayTicks={days}
          dim={loading}
          emptyText={empty}
        />
        <TimeChart
          title="فضای دیسک"
          summary={disk !== null && h.diskTotal ? `اکنون ${formatPct(disk)} از ${formatBytes(h.diskTotal)}` : undefined}
          times={times}
          series={[{ key: "disk", label: "مصرف دیسک", color: "var(--chart-1)", values: h.points.map((p) => p.disk) }]}
          domain={domain}
          gapMs={gapMs}
          yMax={100}
          formatAxis={pctAxis}
          formatValue={formatPct}
          dayTicks={days}
          dim={loading}
          emptyText={empty}
        />
        <TimeChart
          title="شبکه"
          summary={rx ? `میانگین دریافت ${formatRate(rx.avg)} · بیشترین ${formatRate(rx.max)}` : undefined}
          times={times}
          series={[
            { key: "rx", label: "دریافت", color: "var(--chart-1)", values: h.points.map((p) => p.rx) },
            { key: "tx", label: "ارسال", color: "var(--chart-2)", values: h.points.map((p) => p.tx) },
          ]}
          domain={domain}
          gapMs={gapMs}
          ticks={niceByteTicks}
          formatAxis={(v) => formatBytesShort(v, "/s")}
          formatValue={formatRate}
          dayTicks={days}
          dim={loading}
          emptyText={empty}
        />
      </CardContent>
    </Card>
  );
}
