import { ACHIEVEMENTS } from "../minigames/achievementList";
import { type MachineInfo, machines } from "./machineData";

/**
 * Machine info edited in the site's admin panel, merged over the built-in data.
 *
 * The site serves (GET, JSON, contract version 1):
 *   { "version": 1, "machines": { "<machine id>": { "name"?, "prompt"?, "emoji"?, "description"?, "price"?, "photos"?, "listed"? } } }
 * Only known machine ids and these fields are used; everything is length-checked. An empty or
 * missing price means «not registered» — the world never makes a tariff up.
 */
export type MachineOverride = Partial<Pick<MachineInfo, "name" | "prompt" | "emoji" | "description" | "price" | "photos" | "listed">>;

const LIMITS = { name: 80, prompt: 80, emoji: 8, description: 1500, price: 160, alt: 140, photos: 8 };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** Same-site path ("/media/x.webp") or https URL; anything else (javascript:, //host, data:) is dropped. */
export function safePhotoSrc(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length === 0 || s.length > 500) return null;
  if (s.startsWith("/") && !s.startsWith("//") && !s.includes("\\")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** Validates the site's JSON. Returns only the overrides that are safe to apply. */
export function parseMachineOverrides(json: unknown): Record<string, MachineOverride> {
  const out: Record<string, MachineOverride> = {};
  if (!json || typeof json !== "object") return out;
  const root = json as { version?: unknown; machines?: unknown };
  if (root.version !== 1 || !root.machines || typeof root.machines !== "object") return out;
  for (const [id, raw] of Object.entries(root.machines as Record<string, unknown>)) {
    if (!Object.hasOwn(machines, id) || !raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const o: MachineOverride = {};
    const name = str(r.name, LIMITS.name);
    if (name) o.name = name;
    const prompt = str(r.prompt, LIMITS.prompt);
    if (prompt) o.prompt = prompt;
    const emoji = str(r.emoji, LIMITS.emoji);
    if (emoji) o.emoji = emoji;
    const description = str(r.description, LIMITS.description);
    if (description) o.description = description;
    if (r.price === null) o.price = null;
    else if (typeof r.price === "string") o.price = str(r.price, LIMITS.price) || null;
    if (Array.isArray(r.photos)) {
      const photos = r.photos
        .map((p) => {
          if (!p || typeof p !== "object") return null;
          const src = safePhotoSrc((p as { src?: unknown }).src);
          if (!src) return null;
          return { src, alt: str((p as { alt?: unknown }).alt, LIMITS.alt) ?? "" };
        })
        .filter((p): p is { src: string; alt: string } => p !== null)
        .slice(0, LIMITS.photos);
      if (photos.length) o.photos = photos;
    }
    if (typeof r.listed === "boolean") o.listed = r.listed;
    out[id] = o;
  }
  return out;
}

/** Club contact info and opening hours, as entered in the site's settings (never invented here). */
export interface ClubInfo {
  phone: string;
  mobile: string;
  whatsapp: string;
  telegram: string;
  /** free text, e.g. «شنبه تا پنجشنبه، ۱۰ تا ۲۲» */
  hours: string;
  address: string;
  mapUrl: string;
}

export const EMPTY_CLUB: ClubInfo = { phone: "", mobile: "", whatsapp: "", telegram: "", hours: "", address: "", mapUrl: "" };

const phoneOk = (v: string) => /^\+?[\d\s-]{4,20}$/.test(v);
const httpsOk = (v: string) => {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
};

/** `"club": { phone, mobile, whatsapp, telegram, hours, address, mapUrl }` next to `machines`. */
export function parseClub(json: unknown): ClubInfo {
  const out = { ...EMPTY_CLUB };
  if (!json || typeof json !== "object" || (json as { version?: unknown }).version !== 1) return out;
  const c = (json as { club?: unknown }).club;
  if (!c || typeof c !== "object") return out;
  const r = c as Record<string, unknown>;
  const digits = (v: unknown) => (str(v, 20) ?? "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  for (const k of ["phone", "mobile"] as const) {
    const v = digits(r[k]);
    if (v && phoneOk(v)) out[k] = v;
  }
  for (const k of ["whatsapp", "telegram", "mapUrl"] as const) {
    const v = str(r[k], 300);
    if (v && httpsOk(v)) out[k] = v;
  }
  out.hours = str(r.hours, 120) ?? "";
  out.address = str(r.address, 300) ?? "";
  return out;
}

/**
 * Prizes the club attaches to achievements: `"rewards": { "<achievement id>": "متن جایزه" }` next
 * to `machines` in the same JSON. Unknown ids are ignored, text ≤ 120 characters.
 */
export function parseRewards(json: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!json || typeof json !== "object" || (json as { version?: unknown }).version !== 1) return out;
  const r = (json as { rewards?: unknown }).rewards;
  if (!r || typeof r !== "object") return out;
  for (const a of ACHIEVEMENTS) {
    const v = str((r as Record<string, unknown>)[a.id], 120);
    if (v) out[a.id] = v;
  }
  return out;
}
