/**
 * The world configuration the club's manager edits in the admin editor (docs/ADMIN_WORLD.md):
 * where every movable item stands (and added ones), replacement wall art, sign texts and place
 * names, machine info, club contact info and achievement prizes.
 *
 * Pure (no browser / store code): the server validates with it before saving, the game validates
 * again when loading. Anything unknown, unsafe or out of the building is dropped, never trusted.
 */
import { type ClubInfo, type MachineOverride, parseClub, parseMachineOverrides, parseRewards } from "../data/overrideParsers";
import { type Console, ITEM_KINDS, type ItemKindId, type WorldItem } from "./items";
import { ENVIRONMENTS, envById } from "./registry";
import { ART_SLOTS, TEXT_SLOTS, type TextSlot } from "./slots";

export interface WorldConfig {
  version: 1;
  /** ISO time of the last save (set by the server). */
  updatedAt: string | null;
  /** Changes to built-in items, by item id. */
  items: Record<string, { x?: number; z?: number; rotY?: number; hidden?: boolean; number?: number; console?: Console }>;
  /** Items the manager added. */
  added: WorldItem[];
  /** Replacement images by art slot id. */
  art: Record<string, string>;
  /** Replacement texts by text slot id. */
  texts: Record<string, string>;
  machines: Record<string, MachineOverride>;
  /** Contact info and opening hours; null = not set here. */
  club: ClubInfo | null;
  rewards: Record<string, string>;
}

export const EMPTY_WORLD_CONFIG: WorldConfig = { version: 1, updatedAt: null, items: {}, added: [], art: {}, texts: {}, machines: {}, club: null, rewards: {} };

export const LIMITS = { added: 120, textDefault: 40, bytes: 400_000 } as const;

/** Every editable text: lettering in the world, place names (HUD, map) and menu entries. */
export function textSlots(): TextSlot[] {
  const out = [...TEXT_SLOTS];
  for (const e of ENVIRONMENTS) {
    for (const [id, label] of Object.entries(e.areaLabels)) out.push({ id: `area:${id}`, label: `نام بخش: ${label}`, place: e.name, default: label, max: LIMITS.textDefault });
    if (e.menuTravel) out.push({ id: `menu:${e.id}`, label: "دکمهٔ رفتن در منو", place: e.name, default: e.menuTravel.label, max: LIMITS.textDefault });
  }
  return out;
}

/** Built-in images and uploads of the editor; `data:` images only in the stand-alone preview. */
export function safeArtSrc(v: unknown, opts: { allowDataUrls?: boolean } = {}): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^\.?\/atom-world\/[\w/-]+\.(webp|png|jpe?g)$/.test(s) && !s.includes("..")) return s;
  if (/^\/api\/atom-world\/media\/[a-f0-9]{64}\.(webp|png|jpg)$/.test(s)) return s;
  if (opts.allowDataUrls && /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 1_500_000) return s;
  return null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
// centimetres / thousandths of a radian, without float noise (75.55, not 75.55000000000001)
const round = (v: number) => Math.round(v * 100) / 100;
const angle = (v: number) => Math.round(Math.atan2(Math.sin(v), Math.cos(v)) * 1000) / 1000;
const cleanText = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

function insideEnv(envId: string, x: number, z: number) {
  const e = envById(envId);
  if (!e) return false;
  const b = e.bounds;
  return x >= b.xMin && x <= b.xMax && z >= b.zMin && z <= b.zMax;
}

const stationNumber = (v: unknown) => {
  const n = num(v);
  return n !== undefined && Number.isInteger(n) && n >= 1 && n <= 99 ? n : undefined;
};
const consoleOf = (v: unknown): Console | undefined => (v === "ps4" || v === "ps5" ? v : undefined);

/** Validates a saved / downloaded config. Never throws; returns only what is safe to apply. */
export function parseWorldConfig(json: unknown, opts: { allowDataUrls?: boolean } = {}): WorldConfig {
  const out: WorldConfig = { ...EMPTY_WORLD_CONFIG, items: {}, added: [], art: {}, texts: {}, machines: {}, rewards: {} };
  if (!json || typeof json !== "object" || (json as { version?: unknown }).version !== 1) return out;
  const r = json as Record<string, unknown>;
  if (typeof r.updatedAt === "string" && !Number.isNaN(Date.parse(r.updatedAt))) out.updatedAt = new Date(r.updatedAt).toISOString();

  const defaults = new Map(ENVIRONMENTS.flatMap((e) => e.items).map((i) => [i.id, i]));

  // ── moved / turned / hidden built-in items
  if (r.items && typeof r.items === "object") {
    for (const [id, raw] of Object.entries(r.items as Record<string, unknown>)) {
      const d = defaults.get(id);
      if (!d || !raw || typeof raw !== "object") continue;
      const c = raw as Record<string, unknown>;
      const o: WorldConfig["items"][string] = {};
      const x = num(c.x);
      const z = num(c.z);
      if (x !== undefined && z !== undefined && insideEnv(d.env, x, z)) Object.assign(o, { x: round(x), z: round(z) });
      const rot = num(c.rotY);
      if (rot !== undefined) o.rotY = angle(rot);
      if (c.hidden === true) o.hidden = true;
      if (d.kind === "gc-station") {
        const n = stationNumber(c.number);
        if (n !== undefined) o.number = n;
        const cs = consoleOf(c.console);
        if (cs) o.console = cs;
      }
      if (Object.keys(o).length) out.items[id] = o;
    }
  }

  // ── added items
  if (Array.isArray(r.added)) {
    const seen = new Set<string>();
    for (const raw of r.added.slice(0, LIMITS.added)) {
      if (!raw || typeof raw !== "object") continue;
      const a = raw as Record<string, unknown>;
      const id = typeof a.id === "string" && /^add-[a-z0-9-]{1,40}$/.test(a.id) ? a.id : null;
      const kind = typeof a.kind === "string" && Object.hasOwn(ITEM_KINDS, a.kind) ? (a.kind as ItemKindId) : null;
      if (!id || !kind || seen.has(id) || defaults.has(id)) continue;
      const env = typeof a.env === "string" ? a.env : "";
      const level = typeof a.level === "string" ? a.level : "";
      if (!ITEM_KINDS[kind].addTo?.[env]?.includes(level) || !envById(env)?.levels.some((l) => l.id === level)) continue;
      const x = num(a.x);
      const z = num(a.z);
      if (x === undefined || z === undefined || !insideEnv(env, x, z)) continue;
      const item: WorldItem = { id, kind, env, level, x: round(x), z: round(z), rotY: angle(num(a.rotY) ?? 0), added: true };
      const len = num(a.length);
      if (len !== undefined && ITEM_KINDS[kind].defaults?.length !== undefined) item.length = round(Math.min(4, Math.max(0.6, len)));
      if (kind === "gc-station") {
        item.console = consoleOf(a.console) ?? "ps4";
        const n = stationNumber(a.number);
        if (n !== undefined) item.number = n;
      }
      seen.add(id);
      out.added.push(item);
    }
  }

  // ── wall art
  if (r.art && typeof r.art === "object") {
    for (const s of ART_SLOTS) {
      const src = safeArtSrc((r.art as Record<string, unknown>)[s.id], opts);
      if (src) out.art[s.id] = src;
    }
  }

  // ── texts
  if (r.texts && typeof r.texts === "object") {
    for (const s of textSlots()) {
      const t = cleanText((r.texts as Record<string, unknown>)[s.id], s.max);
      if (t) out.texts[s.id] = t;
    }
  }

  // ── machines, club, prizes (same rules as the site's data: data/overrideParsers.ts)
  out.machines = parseMachineOverrides({ version: 1, machines: r.machines });
  if (r.club && typeof r.club === "object") out.club = parseClub({ version: 1, club: r.club });
  out.rewards = parseRewards({ version: 1, rewards: r.rewards });
  return out;
}
