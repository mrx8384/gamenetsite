import type { ComponentType } from "react";
import type { Box, Vec3 } from "../data/environment";
import type { Surface } from "../systems/AudioManager";
import type { QualityLevel, QualityPreset } from "../systems/QualityManager";
import type { WorldItem } from "./items";

/**
 * One 3D environment of ATOM World (the amusement hall, the RC club, later the gaming center…).
 * The character, camera, input, collisions, interactions, menus and mini-games are shared; an
 * environment only describes its own place. Adding one = a new folder + one line in
 * `world/registry.ts`; nothing in the core changes (docs/ENVIRONMENTS.md).
 *
 * Every environment owns a separate rectangle of world space (`bounds`), so geometry and colliders
 * of two environments never overlap. Coordinates inside are plain metres, y = 0 at its main floor.
 */
export interface EnvironmentDef {
  id: string;
  /** Persian name (menus, HUD). */
  name: string;
  /** World-space rectangle that belongs to this environment (x, z). */
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  /** Static colliders, built once per session. */
  colliders: () => Box[];
  /** Ground height without colliders (e.g. a lower sidewalk). Default 0. */
  baseFloor?: (x: number, z: number) => number;
  /** Fixed machines and services the player can walk up to (movable ones are `items`). */
  interactables: Interactable[];
  /** Floor levels (id, floor height, Persian name); items stand on one of them. */
  levels: { id: string; y: number; label: string; /** Area shown first in the admin plan editor (default: bounds). */ view?: { xMin: number; xMax: number; zMin: number; zMax: number } }[];
  /** Built-in movable furniture and machines (the admin editor can move, turn, hide and add). */
  items: WorldItem[];
  /** Named entry points; `default` is required. */
  spawns: Record<string, Spawn> & { default: Spawn };
  /** Doors, corridors, stairs or paths to other environments (see PortalDef). */
  portals: PortalDef[];
  /** Environments joined to this one by an open doorway: drawn together, so each is seen from the other. */
  neighbours?: string[];
  /**
   * Where the player may stand (x / z). A move that would leave it is undone, and a player found
   * outside is brought back to the default spawn — never wandering in the empty space around a building.
   */
  walkable?: (x: number, z: number) => boolean;
  /** Finer place inside the environment (HUD floor label, mini-map). */
  areaAt: (x: number, y: number, z: number) => string;
  /** Persian label for each area id returned by areaAt. */
  areaLabels: Record<string, string>;
  /** Footstep surface; default "tile". */
  surfaceAt?: (x: number, y: number, z: number, onStairs: boolean) => Surface;
  /**
   * The scene (models, textures). A separate download (code split) loaded only when needed:
   * - "initial": with the first screen (the start environment)
   * - "after-initial": right after the start environment is ready
   * - "on-demand": when the player travels there, or comes within `preloadDistance` metres of it
   */
  scene: () => Promise<{ default: ComponentType<EnvSceneProps> }>;
  load: "initial" | "after-initial" | "on-demand";
  preloadDistance?: number;
  /** Shown in the menu as a place to go to directly (until a real doorway is confirmed). */
  menuTravel?: { label: string; spawn?: string };
  /** Files under /public this environment downloads (offline copy, documentation). */
  assets?: string[];
  /** Its mini-map, drawn from data (world coordinates). Without one the map says it is not mapped. */
  mapPlan?: MapPlan;
}

/** A data-driven floor plan for the mini-map: shapes in world x / z, in metres. */
export interface MapPlan {
  viewBox: { x: number; y: number; w: number; h: number };
  shapes: MapShape[];
}
export type MapShape =
  | { kind: "rect"; x0: number; z0: number; x1: number; z1: number; fill: string; opacity?: number; rx?: number; /** interactable id to highlight */ hot?: string }
  | { kind: "text"; x: number; z: number; text: string; size?: number; fill?: string };

export interface Interactable {
  id: string;
  machineId: string;
  position: Vec3;
  radius: number;
}

export interface Spawn {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/**
 * A connection between environments. `kind` says what it is in the real building:
 * - "door" / "stairs": a doorway — interact (E) to go through, or walk into it when `walkThrough`
 * - "corridor" / "path": an open passage — the two environments' geometry meet, the player just
 *   walks on (no teleport); the portal only makes sure the next scene is loaded in time
 * - "menu": no real connection known yet (menu / button travel only)
 */
export interface PortalDef {
  id: string;
  kind: "door" | "stairs" | "corridor" | "path" | "menu";
  /** World position of the doorway, and how close the player must be. */
  at: Vec3;
  radius: number;
  to: { env: string; spawn?: string };
  /** Prompt / label, e.g. «🚪 بازگشت به سالن اصلی». */
  prompt: string;
  /** Walking into the doorway travels (no key press). */
  walkThrough?: boolean;
  /** Distance at which the prompt shows (and E travels); default `radius`. Lets a walk-through door announce itself before you reach it. */
  promptRadius?: number;
}

export interface EnvSceneProps {
  quality: QualityLevel;
  preset: QualityPreset;
  /** The player is in this environment (inactive scenes stay loaded but hidden). */
  active: boolean;
}

/** Where to send the player: an environment and one of its spawns. */
export interface TravelTarget {
  env: string;
  spawn?: string;
}
