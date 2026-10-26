import { SCORES_URL } from "../config";
import type { MiniGameId } from "../data/machines";

/**
 * Score tables. Always kept on this device (top 10 per game); also sent to / read from the site
 * when NEXT_PUBLIC_ATOM_SCORES_URL is set (contract: docs/SCORES.md). Scores come from the
 * browser, so the site must treat them as claims: rate-limit, sanity-check, and never hand out a
 * prize on a score alone.
 */
export interface ScoreEntry {
  name: string;
  score: number;
  detail: string;
  /** ms since epoch */
  at: number;
}

const TOP = 10;
const NAME_KEY = "atom-world:player-name";
const key = (g: MiniGameId) => `atom-world:scores:${g}`;

/** Visible name: trimmed, single spaces, no control / markup characters, ≤ 20 characters. */
export function cleanName(raw: string) {
  return raw
    .replace(/[\u0000-\u001f\u007f<>{}[\]\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
}

export function loadName() {
  try {
    return cleanName(window.localStorage.getItem(NAME_KEY) ?? "");
  } catch {
    return "";
  }
}

export function saveName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, cleanName(name));
  } catch {
    /* private mode */
  }
}

function validEntry(e: unknown): e is ScoreEntry {
  if (!e || typeof e !== "object") return false;
  const o = e as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.score === "number" && Number.isFinite(o.score) && typeof o.at === "number";
}

function sanitize(list: unknown): ScoreEntry[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter(validEntry)
    .map((e) => ({ name: cleanName(e.name) || "بازیکن", score: Math.round(e.score), detail: typeof e.detail === "string" ? e.detail.slice(0, 80) : "", at: e.at }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, TOP);
}

export function localTop(game: MiniGameId): ScoreEntry[] {
  try {
    return sanitize(JSON.parse(window.localStorage.getItem(key(game)) ?? "[]"));
  } catch {
    return [];
  }
}

/** Adds a score to this device's table. Returns its rank (1-based) or null if it didn't make the top 10. */
export function addLocal(game: MiniGameId, entry: ScoreEntry): number | null {
  const list = sanitize([...localTop(game), entry]);
  try {
    window.localStorage.setItem(key(game), JSON.stringify(list));
  } catch {
    /* private mode: the table just isn't kept */
  }
  const i = list.findIndex((e) => e.at === entry.at && e.score === entry.score && e.name === entry.name);
  return i >= 0 ? i + 1 : null;
}

export const sharedScores = () => !!SCORES_URL;

/** Top scores of everyone, from the site; null when not configured or unreachable. */
export async function remoteTop(game: MiniGameId, url = SCORES_URL): Promise<ScoreEntry[] | null> {
  if (!url) return null;
  try {
    const res = await fetch(`${url}?game=${encodeURIComponent(game)}`, { headers: { accept: "application/json" }, credentials: "same-origin", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { version?: unknown; scores?: unknown };
    return json.version === 1 ? sanitize(json.scores) : null;
  } catch {
    return null;
  }
}

/** Sends a score to the site. Game stats go along so the site can sanity-check it. */
export async function submitRemote(game: MiniGameId, entry: ScoreEntry, stats: Record<string, number | boolean>, url = SCORES_URL) {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ version: 1, game, name: entry.name, score: entry.score, detail: entry.detail, stats }),
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
