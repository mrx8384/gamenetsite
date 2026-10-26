import { EVENTS_URL, isTestPath } from "../config";
import { createStore } from "../store";

/**
 * Tournaments and news from the site (phase 11). Shapes follow the site's own data:
 * gamenetsite `getPublicTournaments()` (TournamentCard) and published NewsPost rows.
 * Contract: docs/EVENTS.md. Nothing is invented — with no data the board says so.
 */
export type TournamentStatus = "REGISTRATION" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TournamentFormat = "SINGLE_ELIMINATION" | "DOUBLE_ELIMINATION" | "ROUND_ROBIN" | "GROUPS_KNOCKOUT";

export interface TournamentItem {
  slug: string;
  name: string;
  game: string;
  platform: string | null;
  format: TournamentFormat;
  status: TournamentStatus;
  startsAt: string | null;
  participantCount: number;
  maxParticipants: number | null;
  organizerName: string;
  prize: string | null;
}

export interface NewsItem {
  slug: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
}

/** The site's own labels (gamenetsite src/features/tournaments/constants.ts). */
export const STATUS_LABEL: Record<TournamentStatus, string> = {
  REGISTRATION: "ثبت‌نام باز",
  IN_PROGRESS: "در حال برگزاری",
  COMPLETED: "پایان‌یافته",
  CANCELLED: "لغوشده",
};
export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  SINGLE_ELIMINATION: "حذفی یک‌باخت",
  DOUBLE_ELIMINATION: "حذفی دوباخت",
  ROUND_ROBIN: "لیگی (همه با همه)",
  GROUPS_KNOCKOUT: "گروهی + حذفی",
};

export interface EventsState {
  loaded: boolean;
  tournaments: TournamentItem[];
  news: NewsItem[];
}

export const eventsStore = createStore<EventsState>({ loaded: false, tournaments: [], news: [] });

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const slugOk = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(v);
const dateOk = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const intOk = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null);

export function parseEvents(json: unknown): { tournaments: TournamentItem[]; news: NewsItem[] } {
  const out = { tournaments: [] as TournamentItem[], news: [] as NewsItem[] };
  if (!json || typeof json !== "object" || (json as { version?: unknown }).version !== 1) return out;
  const root = json as { tournaments?: unknown; news?: unknown };
  if (Array.isArray(root.tournaments)) {
    for (const raw of root.tournaments.slice(0, 50)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const name = str(r.name, 120);
      if (!slugOk(r.slug) || !name || !(typeof r.status === "string" && r.status in STATUS_LABEL) || !(typeof r.format === "string" && r.format in FORMAT_LABEL)) continue;
      out.tournaments.push({
        slug: r.slug,
        name,
        game: str(r.game, 80) ?? "",
        platform: str(r.platform, 40),
        format: r.format as TournamentFormat,
        status: r.status as TournamentStatus,
        startsAt: dateOk(r.startsAt),
        participantCount: intOk(r.participantCount, 10000) ?? 0,
        maxParticipants: intOk(r.maxParticipants, 10000),
        organizerName: str(r.organizerName, 80) ?? "اتم گیم کلاب",
        prize: str(r.prize, 500),
      });
    }
  }
  if (Array.isArray(root.news)) {
    for (const raw of root.news.slice(0, 20)) {
      if (!raw || typeof raw !== "object") continue;
      const r = raw as Record<string, unknown>;
      const title = str(r.title, 200);
      if (!slugOk(r.slug) || !title) continue;
      out.news.push({ slug: r.slug, title, excerpt: str(r.excerpt, 500), publishedAt: dateOk(r.publishedAt) });
    }
  }
  return out;
}

/** What the board shows: open registration first, then running, then finished in the last 30 days (no cancelled ones). */
export function boardTournaments(list: TournamentItem[], now = Date.now()) {
  const rank: Record<TournamentStatus, number> = { REGISTRATION: 0, IN_PROGRESS: 1, COMPLETED: 2, CANCELLED: 3 };
  const recent = (t: TournamentItem) => t.status !== "COMPLETED" || !t.startsAt || now - Date.parse(t.startsAt) < 30 * 86400_000;
  return list
    .filter((t) => t.status !== "CANCELLED" && recent(t))
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.startsAt && b.startsAt ? Date.parse(a.startsAt) - Date.parse(b.startsAt) : a.startsAt ? -1 : 1));
}

/** «شنبه ۳ آبان، ساعت ۱۸:۳۰» in Tehran time. */
export function formatStart(iso: string | null) {
  if (!iso) return "زمان شروع هنوز اعلام نشده";
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Tehran" }).format(d);
  const time = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(d);
  return `${day}، ساعت ${time}`;
}

/** «۳ روز دیگر» / «۲ ساعت پیش». */
export function relativeStart(iso: string | null, now = Date.now()) {
  if (!iso) return "";
  const diff = Date.parse(iso) - now;
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 3600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86400_000) return rtf.format(Math.round(diff / 3600_000), "hour");
  return rtf.format(Math.round(diff / 86400_000), "day");
}

let loadedUrl: string | null = null;

export async function loadEvents(url: string = eventsUrl()) {
  if (!url) {
    eventsStore.set({ loaded: true });
    return false;
  }
  if (loadedUrl === url) return true;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" }, credentials: "omit", signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = parseEvents(await res.json());
    eventsStore.set({ loaded: true, ...data });
    loadedUrl = url;
    return true;
  } catch {
    eventsStore.set({ loaded: true });
    return false;
  }
}

/** Configured endpoint; with ?debug=1 a same-site `?eventsUrl=/path` can override it (tests). */
function eventsUrl() {
  if (typeof window === "undefined") return EVENTS_URL;
  const q = new URLSearchParams(window.location.search);
  const dbg = q.has("debug") ? q.get("eventsUrl") : null;
  return dbg && isTestPath(dbg) ? dbg : EVENTS_URL;
}
