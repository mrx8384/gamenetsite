/** History ranges of Admin → وضعیت سرور: length and bucket size (≈ 60–360 points per chart). Pure. */
export const HISTORY_RANGES = ["1h", "24h", "7d", "30d"] as const;
export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const RANGE_SPEC: Record<HistoryRange, { label: string; seconds: number; bucket: number }> = {
  "1h": { label: "۱ ساعت", seconds: 3600, bucket: 60 },
  "24h": { label: "۲۴ ساعت", seconds: 86_400, bucket: 300 },
  "7d": { label: "۷ روز", seconds: 604_800, bucket: 1800 },
  "30d": { label: "۳۰ روز", seconds: 2_592_000, bucket: 7200 },
};

export const isHistoryRange = (v: unknown): v is HistoryRange => typeof v === "string" && (HISTORY_RANGES as readonly string[]).includes(v);

export interface HistoryPoint {
  /** Bucket start, epoch milliseconds. */
  t: number;
  cpu: number;
  cpuMax: number;
  mem: number;
  swap: number;
  disk: number;
  load: number;
  /** Average bytes per second in the bucket. */
  rx: number;
  tx: number;
  app: number;
}

export interface History {
  range: HistoryRange;
  bucketSec: number;
  points: HistoryPoint[];
  memTotal: number;
  diskTotal: number;
}
