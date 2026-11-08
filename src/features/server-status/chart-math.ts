/** Pure helpers for the server charts (axis ticks, line breaks at gaps, hover lookup). */

/** Round numbers for an axis from 0 to about `max`: steps of 1, 2 or 5 × 10^k. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

/** Byte-rate axis: nice steps inside the unit that fits the maximum (KB, MB, …, base 1024). */
export function niceByteTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1024];
  let unit = 1;
  while (max / unit >= 1024 && unit < 1024 ** 4) unit *= 1024;
  return niceTicks(max / unit, count).map((v) => v * unit);
}

/**
 * Indexes of each continuous run of points: a new run starts after a missing value or a time gap
 * longer than `gapMs` (the site was down or not sampling), so the chart never draws across it.
 */
export function segments(times: number[], values: (number | null)[], gapMs: number): number[][] {
  const out: number[][] = [];
  let run: number[] = [];
  for (let i = 0; i < times.length; i++) {
    const v = values[i];
    const gap = run.length > 0 && times[i] - times[run[run.length - 1]] > gapMs;
    if (v === null || !Number.isFinite(v) || gap) {
      if (run.length) out.push(run);
      run = [];
      if (v === null || !Number.isFinite(v)) continue;
    }
    run.push(i);
  }
  if (run.length) out.push(run);
  return out;
}

/** Index of the point nearest in time to `t` (times ascending). */
export function nearestIndex(times: number[], t: number): number {
  if (times.length === 0) return -1;
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  return Math.abs(times[hi] - t) < Math.abs(times[lo] - t) ? hi : lo;
}
