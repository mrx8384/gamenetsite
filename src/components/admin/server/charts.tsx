"use client";

import * as React from "react";
import { nearestIndex, niceTicks, segments } from "@/features/server-status/chart-math";
import { formatClock, formatDay, formatMoment } from "@/features/server-status/format";
import { cn } from "@/lib/utils";

/**
 * Time-series line chart (SVG, no chart library). Time runs left → right; hairline grid; 2px lines;
 * a 10% wash under a single series; lines break where samples are missing. A crosshair snaps to the
 * nearest time on hover / touch / arrow keys and one readout lists every series; the same numbers are
 * in the table under the chart.
 */
export interface ChartSeries {
  key: string;
  label: string;
  /** CSS colour, e.g. "var(--chart-1)". */
  color: string;
  values: (number | null)[];
}

interface Props {
  title: string;
  /** One-line summary under the title (also the chart's accessible description). */
  summary?: string;
  times: number[];
  series: ChartSeries[];
  domain: [number, number];
  gapMs: number;
  /** Fixed top of the y axis (e.g. 100 for percentages); otherwise derived from the data. */
  yMax?: number;
  ticks?: (max: number) => number[];
  formatAxis: (v: number) => string;
  formatValue: (v: number) => string;
  /** Extra readout rows for a point (e.g. the CPU peak inside the bucket). */
  extra?: (i: number) => { label: string; value: string }[];
  /** Day labels on the time axis instead of clock times (ranges of several days). */
  dayTicks?: boolean;
  /** Data is reloading: keep the frame, dimmed. */
  dim?: boolean;
  emptyText?: string;
}

const H = 180;
const M = { l: 52, r: 14, t: 12, b: 26 };

function useElementWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

export function TimeChart({ title, summary, times, series, domain, gapMs, yMax, ticks = niceTicks, formatAxis, formatValue, extra, dayTicks = false, dim = false, emptyText = "داده‌ای برای این بازه نیست." }: Props) {
  const box = React.useRef<HTMLDivElement>(null);
  const width = useElementWidth(box);
  const [hover, setHover] = React.useState<number | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  const [d0, d1] = domain;
  const pw = Math.max(10, width - M.l - M.r);
  const ph = H - M.t - M.b;
  const dataMax = Math.max(0, ...series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v))));
  const yTicks = yMax !== undefined ? ticks(yMax) : ticks(dataMax * 1.1 || 1);
  const top = yMax ?? yTicks[yTicks.length - 1];
  const x = (t: number) => M.l + ((t - d0) / Math.max(1, d1 - d0)) * pw;
  const y = (v: number) => M.t + ph - (Math.min(v, top) / top) * ph;
  const xTicks = Array.from({ length: 5 }, (_, k) => d0 + ((d1 - d0) * k) / 4);
  const hasData = times.length > 0 && series.some((s) => s.values.some((v) => v !== null));
  const single = series.length === 1;

  const pointerTo = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !times.length) return;
    const t = d0 + ((clientX - rect.left - M.l) / pw) * (d1 - d0);
    setHover(nearestIndex(times, t));
  };

  const readout = hover !== null && times[hover] !== undefined ? hover : null;
  const rows =
    readout !== null
      ? [
          ...series.map((s) => ({ key: s.key, label: s.label, color: s.color, value: s.values[readout] === null ? "—" : formatValue(s.values[readout] as number) })),
          ...(extra?.(readout) ?? []).map((r, i) => ({ key: `extra-${i}`, label: r.label, color: null, value: r.value })),
        ]
      : [];
  const tipLeft = readout !== null ? x(times[readout]) : 0;
  const flip = tipLeft > width - 190;

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption>
        <p id={titleId} className="text-sm font-bold">{title}</p>
        {summary ? <p id={descId} className="text-xs text-muted-foreground">{summary}</p> : null}
      </figcaption>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="راهنمای نمودار">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div
        ref={box}
        dir="ltr"
        tabIndex={hasData ? 0 : -1}
        role="group"
        aria-labelledby={titleId}
        aria-describedby={summary ? descId : undefined}
        className={cn("relative rounded-lg outline-none transition-opacity focus-visible:ring-[3px] focus-visible:ring-ring/50", dim && "opacity-50")}
        style={{ height: H }}
        onKeyDown={(e) => {
          if (!times.length) return;
          const cur = hover ?? times.length - 1;
          const next = e.key === "ArrowLeft" ? cur - 1 : e.key === "ArrowRight" ? cur + 1 : e.key === "Home" ? 0 : e.key === "End" ? times.length - 1 : null;
          if (e.key === "Escape") return setHover(null);
          if (next === null) return;
          e.preventDefault();
          setHover(Math.max(0, Math.min(times.length - 1, next)));
        }}
        onFocus={() => hover === null && times.length && setHover(times.length - 1)}
        onBlur={() => setHover(null)}
      >
        {width > 0 ? (
          <svg width={width} height={H} className="block overflow-visible" aria-hidden>
            {yTicks.map((v) => (
              <g key={v}>
                <line x1={M.l} x2={M.l + pw} y1={y(v)} y2={y(v)} stroke="var(--chart-grid)" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={M.l - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-[var(--chart-axis)] text-[10px] tabular-nums">{formatAxis(v)}</text>
              </g>
            ))}
            {xTicks.map((t, k) => (
              <text key={t} x={x(t)} y={H - 6} textAnchor={k === 0 ? "start" : k === 4 ? "end" : "middle"} className="fill-[var(--chart-axis)] text-[10px] tabular-nums">
                {dayTicks ? formatDay(t) : formatClock(t)}
              </text>
            ))}
            {hasData
              ? series.map((s) =>
                  segments(times, s.values, gapMs).map((run) => {
                    const pts = run.map((i) => [x(times[i]), y(s.values[i] as number)] as const);
                    if (pts.length === 1) return <circle key={`${s.key}-${run[0]}`} cx={pts[0][0]} cy={pts[0][1]} r={2.5} fill={s.color} />;
                    const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
                    const base = y(0);
                    return (
                      <g key={`${s.key}-${run[0]}`}>
                        {single ? <path d={`${line}L${pts[pts.length - 1][0].toFixed(1)},${base}L${pts[0][0].toFixed(1)},${base}Z`} fill={s.color} opacity={0.1} /> : null}
                        <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      </g>
                    );
                  }),
                )
              : null}
            {readout !== null ? (
              <g>
                <line x1={x(times[readout])} x2={x(times[readout])} y1={M.t} y2={M.t + ph} stroke="var(--chart-axis)" strokeWidth={1} shapeRendering="crispEdges" />
                {series.map((s) =>
                  s.values[readout] === null ? null : <circle key={s.key} cx={x(times[readout])} cy={y(s.values[readout] as number)} r={4} fill={s.color} stroke="var(--surface)" strokeWidth={2} />,
                )}
              </g>
            ) : null}
            {hasData ? (
              <rect
                x={M.l}
                y={M.t}
                width={pw}
                height={ph}
                fill="transparent"
                style={{ touchAction: "pan-y" }}
                onPointerMove={(e) => pointerTo(e.clientX)}
                onPointerDown={(e) => pointerTo(e.clientX)}
                onPointerLeave={() => setHover(null)}
              />
            ) : null}
          </svg>
        ) : null}
        {!hasData ? <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground" dir="rtl">{emptyText}</p> : null}
        {readout !== null ? (
          <div
            dir="rtl"
            className="pointer-events-none absolute z-10 min-w-40 rounded-lg border bg-surface px-3 py-2 text-xs shadow-lg"
            style={{ top: M.t, ...(flip ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }) }}
          >
            <p className="mb-1 text-muted-foreground">{formatMoment(times[readout])}</p>
            <ul className="space-y-0.5">
              {rows.map((r) => (
                <li key={r.key} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {r.color ? <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} aria-hidden /> : null}
                    {r.label}
                  </span>
                  <span className="font-bold text-foreground">{r.value}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="sr-only" aria-live="polite">
        {readout !== null ? `${formatMoment(times[readout])}: ${rows.map((r) => `${r.label} ${r.value}`).join("، ")}` : ""}
      </p>
      {hasData ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">نمایش جدول داده‌ها</summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-lg border">
            <table className="w-full text-start">
              <thead className="sticky top-0 bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-start font-medium">زمان</th>
                  {series.map((s) => <th key={s.key} className="px-2 py-1 text-start font-medium">{s.label}</th>)}
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {times.map((t, i) => (
                  <tr key={t} className="border-t">
                    <td className="px-2 py-1 whitespace-nowrap">{formatMoment(t)}</td>
                    {series.map((s) => <td key={s.key} className="px-2 py-1 whitespace-nowrap">{s.values[i] === null ? "—" : formatValue(s.values[i] as number)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </figure>
  );
}

/** Tiny trend line for a stat tile: muted line, current value as a dot in the accent colour. Shrinks to fit. */
export function Sparkline({ values, max, className }: { values: number[]; max?: number; className?: string }) {
  const W = 120;
  const SH = 32;
  const cls = cn("block h-auto w-full max-w-[120px] overflow-visible", className);
  if (values.length < 2) return <svg viewBox={`0 0 ${W} ${SH}`} className={cls} aria-hidden />;
  const top = max ?? Math.max(1, ...values) * 1.1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (W - 6) + 1, SH - 4 - (Math.min(v, top) / top) * (SH - 8)] as const);
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${SH}`} className={cls} aria-hidden>
      <path d={d} fill="none" stroke="var(--chart-muted)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={3.5} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
