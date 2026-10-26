"use client";

import { useSyncExternalStore } from "react";
import type { CharacterId } from "./data/characters";
import type { MiniGameId } from "./data/machines";
import type { Area } from "./data/world";
import type { TravelTarget } from "./world/types";
import type { QualityLevel } from "./systems/QualityManager";

/** UI state shared between the 3D scene and the HTML overlay. */
export interface WorldState {
  phase: "select" | "play";
  character: CharacterId;
  quality: QualityLevel;
  /** Interactable the player is standing next to. */
  nearby: { id: string; machineId: string } | null;
  /** Machine whose info panel is open. */
  panel: { id: string; machineId: string } | null;
  menuOpen: boolean;
  mapOpen: boolean;
  helpOpen: boolean;
  /** Scene assets loaded. */
  ready: boolean;
  /** Where the player is (HUD floor label, mini-map). */
  area: Area;
  /** Request from the UI to move the player to another environment (handled inside the Canvas). */
  travel: TravelTarget | null;
  /** Environment the player is in (world/registry.ts); the selected character stays the same everywhere. */
  env: string;
  /** List of games & services (menu). */
  listOpen: boolean;
  /** Interactable highlighted on the big map. */
  mapFocus: string | null;
  sound: boolean;
  volume: number;
  /** Short message shown for a few seconds. */
  toast: string | null;
  /** Asset loading progress 0..1. */
  loadProgress: number;
  /** The WebGL context was lost. */
  contextLost: boolean;
  /** Mini-game being played (the 3D world is paused meanwhile). */
  miniGame: MiniGameId | null;
  /** Interactable the mini-game was started from (e.g. which gaming-center station). */
  miniGameFrom: string | null;
  /** Score tables & achievements panel. */
  scoresOpen: boolean;
  /** Invite link (?room=12345&game=…): open that game's online lobby once in the world. */
  pendingRoom: { code: string; game: MiniGameId } | null;
  /** «ساعت کاری و رزرو» panel (machineId pre-selects the game). */
  booking: { machineId: string | null } | null;
  /** Tournaments & events panel. */
  eventsOpen: boolean;
  /** «کاهش حرکت»: no camera swoops / tilts, no bobbing or flicker (default: the device setting). */
  reducedMotion: boolean;
  /** «اندازهٔ متن»: 1, 1.15 or 1.3 */
  textScale: number;
}

type Listener = () => void;

export function createStore<T extends object>(initial: T) {
  let state = initial;
  const listeners = new Set<Listener>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === "function" ? patch(state) : patch;
      let changed = false;
      for (const k in p) {
        if (!Object.is(state[k], p[k])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...p };
      listeners.forEach((l) => l());
    },
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export const worldStore = createStore<WorldState>({
  phase: "select",
  character: "boy",
  quality: "medium",
  nearby: null,
  panel: null,
  menuOpen: false,
  mapOpen: false,
  helpOpen: false,
  ready: false,
  area: "street",
  travel: null,
  env: "amusement",
  listOpen: false,
  mapFocus: null,
  sound: true,
  volume: 0.7,
  toast: null,
  loadProgress: 0,
  contextLost: false,
  miniGame: null,
  miniGameFrom: null,
  scoresOpen: false,
  pendingRoom: null,
  booking: null,
  eventsOpen: false,
  reducedMotion: false,
  textScale: 1,
});

export function useWorld<S>(selector: (s: WorldState) => S): S {
  return useSyncExternalStore(
    worldStore.subscribe,
    () => selector(worldStore.get()),
    () => selector(worldStore.get()),
  );
}

/** True while an overlay owns the input (menus, info panel). */
export function inputBlocked(s: WorldState = worldStore.get()) {
  return s.menuOpen || s.mapOpen || s.listOpen || s.panel !== null || s.miniGame !== null || s.scoresOpen || s.booking !== null || s.eventsOpen;
}

/** Player pose for the mini-map; written by the controller (not reactive, read on an interval). */
export const playerPose = { x: 0, z: 0, heading: 0, floor: 0 };

const STORAGE = {
  character: "atom-world:character",
  quality: "atom-world:quality",
  sound: "atom-world:sound",
  volume: "atom-world:volume",
  motion: "atom-world:reduced-motion",
  text: "atom-world:text-scale",
} as const;

export function loadPref(key: keyof typeof STORAGE): string | null {
  try {
    return window.localStorage.getItem(STORAGE[key]);
  } catch {
    return null;
  }
}

export function savePref(key: keyof typeof STORAGE, value: string) {
  try {
    window.localStorage.setItem(STORAGE[key], value);
  } catch {
    /* private mode: preference is just not remembered */
  }
}

const HELP_KEY = "atom-world:help-seen";

export function hasSeenHelp() {
  try {
    return window.localStorage.getItem(HELP_KEY) === "1";
  } catch {
    return false;
  }
}

export function closeHelp() {
  try {
    window.localStorage.setItem(HELP_KEY, "1");
  } catch {
    /* ignore */
  }
  worldStore.set({ helpOpen: false });
}

