/** Display helpers for Admin → وضعیت سرور (pure; Persian digits, Iran time). */

const nf0 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });
const UNITS = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
const SHORT_UNITS = ["B", "KB", "MB", "GB", "TB"];

function scale(n: number) {
  let v = Number.isFinite(n) && n > 0 ? n : 0;
  let i = 0;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  return { v, i };
}

/** 3_435_973_837 → «۳٫۲ گیگابایت» */
export function formatBytes(n: number): string {
  const { v, i } = scale(n);
  return `${(v >= 100 || i === 0 ? nf0 : nf1).format(v)} ${UNITS[i]}`;
}

/** Compact form for chart axes: «۱۲۰ KB/s». */
export function formatBytesShort(n: number, suffix = ""): string {
  const { v, i } = scale(n);
  return `${(v >= 10 || i === 0 ? nf0 : nf1).format(v)} ${SHORT_UNITS[i]}${suffix}`;
}

export const formatRate = (bytesPerSecond: number) => `${formatBytes(bytesPerSecond)} در ثانیه`;

export const formatPct = (n: number) => `${nf0.format(Math.round(Number.isFinite(n) ? n : 0))}٪`;

export const formatNum1 = (n: number) => nf1.format(n);

/** 273_600 → «۳ روز و ۴ ساعت» */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h > 0 ? `${nf0.format(d)} روز و ${nf0.format(h)} ساعت` : `${nf0.format(d)} روز`;
  if (h > 0) return m > 0 ? `${nf0.format(h)} ساعت و ${nf0.format(m)} دقیقه` : `${nf0.format(h)} ساعت`;
  return `${nf0.format(Math.max(m, s > 0 ? 1 : 0))} دقیقه`;
}

const timeFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", day: "numeric", month: "long" });
const fullFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export const formatClock = (ms: number) => timeFmt.format(ms);
const secFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export const formatClockSeconds = (ms: number) => secFmt.format(ms);
export const formatDay = (ms: number) => dayFmt.format(ms);
export const formatMoment = (ms: number) => fullFmt.format(ms);
