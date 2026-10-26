"use client";

import { ADMIN_MODE, isTestPath, LOCAL_CONFIG_KEY, WORLD_URL } from "../config";
import { setAdminOverrides } from "../data/remoteMachines";
import { EMPTY_WORLD_CONFIG, parseWorldConfig, type WorldConfig } from "./config";
import { setItemChanges } from "./registry";
import { setSlotOverrides } from "./slots";

/**
 * Loads the manager's world configuration (admin editor) and applies it before a session starts:
 * item places, wall art, texts, machine info, club info, prizes. The last good copy is kept on the
 * device, so the world looks the same offline. On any failure the built-in world is used.
 */
const CACHE_KEY = "atom-world:world-config";

export function applyWorldConfig(cfg: WorldConfig) {
  setItemChanges({ items: cfg.items, added: cfg.added });
  setSlotOverrides(cfg.art, cfg.texts);
  setAdminOverrides(cfg.machines, cfg.club, cfg.rewards);
}

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

function configUrl() {
  const q = new URLSearchParams(window.location.search);
  const dbg = q.has("debug") ? q.get("worldUrl") : null;
  return dbg && isTestPath(dbg) ? dbg : WORLD_URL;
}

let pending: Promise<WorldConfig> | null = null;

/** Starts loading once (character selection screen); resolves within `timeoutMs` at the latest. */
export function loadWorldConfig(timeoutMs = 4000): Promise<WorldConfig> {
  if (pending) return pending;
  pending = (async () => {
    const local = ADMIN_MODE === "local" || !configUrl();
    const allowDataUrls = local;
    let cfg: WorldConfig = EMPTY_WORLD_CONFIG;
    const cached = read(local ? LOCAL_CONFIG_KEY : CACHE_KEY);
    if (cached) {
      try {
        cfg = parseWorldConfig(JSON.parse(cached), { allowDataUrls });
      } catch {
        /* broken copy: ignore */
      }
    }
    if (!local) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(configUrl(), { signal: ctrl.signal, headers: { accept: "application/json" }, cache: "no-store" });
        if (res.ok) {
          const json: unknown = await res.json();
          cfg = parseWorldConfig(json);
          try {
            window.localStorage.setItem(CACHE_KEY, JSON.stringify(cfg));
          } catch {
            /* storage full / private mode */
          }
        }
      } catch {
        /* offline or slow: the cached copy (or the built-in world) stays */
      } finally {
        clearTimeout(t);
      }
    }
    applyWorldConfig(cfg);
    return cfg;
  })();
  return pending;
}

/** For tests and the editor's «see it in the world». */
export function resetWorldConfigLoad() {
  pending = null;
}
