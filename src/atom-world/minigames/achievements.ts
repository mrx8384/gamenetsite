import { createStore } from "../store";
import type { MiniGameId } from "../data/machines";

/**
 * Achievements earned in the mini-games (kept on this device). A prize can be attached to an
 * achievement by the club in the admin panel (`rewards` in the machines JSON); none is invented here.
 */
export { ACHIEVEMENTS, type Achievement, type Stats } from "./achievementList";
import { ACHIEVEMENTS, type Achievement, type Stats } from "./achievementList";

const KEY = "atom-world:achievements";
const PLAYED = "atom-world:played";

function read<T>(k: string, fallback: T): T {
  try {
    const v = JSON.parse(window.localStorage.getItem(k) ?? "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function write(k: string, v: unknown) {
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

/** id → time earned */
export function earned(): Record<string, number> {
  const v = read<Record<string, number>>(KEY, {});
  return typeof v === "object" && v ? v : {};
}

/** Records a finished round; returns the achievements earned for the first time. */
export function recordRound(game: MiniGameId, stats: Stats, now = Date.now()): Achievement[] {
  const played = new Set<MiniGameId>(read<MiniGameId[]>(PLAYED, []));
  played.add(game);
  write(PLAYED, [...played]);
  const have = earned();
  const fresh = ACHIEVEMENTS.filter((a) => !have[a.id] && a.test(game, stats, played));
  if (fresh.length) {
    for (const a of fresh) have[a.id] = now;
    write(KEY, have);
  }
  return fresh;
}

/** Prize text per achievement id, set by the club (admin panel). Empty = no prize. */
export const rewardStore = createStore<{ byId: Record<string, string> }>({ byId: {} });
