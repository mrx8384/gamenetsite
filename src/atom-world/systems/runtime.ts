"use client";

import { createContext, useContext } from "react";
import { type Vec3 } from "../data/environment";
import { buildWorldColliders, envById, resolveSpawn, START_ENV, worldBaseFloor, worldInteractables } from "../world/registry";
import type { TravelTarget } from "../world/types";
import { CollisionWorld } from "./CollisionSystem";
import { createInput, type InputState } from "./input";

/** Per-session mutable game state shared by the systems inside the Canvas (never triggers renders). */
export interface Runtime {
  input: InputState;
  world: CollisionWorld;
  camera: { yaw: number; pitch: number; distance: number; /** jump straight to the player next frame */ snap: boolean };
  player: { x: number; y: number; z: number; heading: number; vy: number; grounded: boolean; speed: number; onStairs: boolean };
  interactables: { id: string; machineId: string; position: Vec3; radius: number }[];
  /** Interactable the camera should focus on (info panel open), or null. */
  focus: Vec3 | null;
}

export function createRuntime(): Runtime {
  // colliders of every environment (cheap boxes); their scenes load separately when needed
  const world = new CollisionWorld(buildWorldColliders(), worldBaseFloor);
  const start = envById(START_ENV)!.spawns.default;
  return {
    input: createInput(),
    world,
    // the game starts at the start environment's entry (the sidewalk in front of the hall)
    camera: { yaw: start.heading + Math.PI, pitch: 0.28, distance: 4.6, snap: true },
    player: { x: start.x, y: start.y, z: start.z, heading: start.heading, vy: 0, grounded: true, speed: 0, onStairs: false },
    interactables: worldInteractables().map((i) => ({ ...i })),
    focus: null,
  };
}

/**
 * Moves the player to an environment's spawn. Only the position changes: the selected character,
 * its animation state, scores and settings stay as they are.
 */
export function travelTo(rt: Runtime, target: TravelTarget) {
  const s = resolveSpawn(target);
  if (!s) return false;
  const p = rt.player;
  Object.assign(p, { x: s.x, y: s.y, z: s.z, heading: s.heading, vy: 0, onStairs: false });
  rt.camera.yaw = p.heading + Math.PI;
  rt.camera.pitch = 0.32;
  rt.camera.snap = true;
  rt.focus = null;
  return true;
}

export type RuntimeRef = { readonly current: Runtime };

export const RuntimeContext = createContext<RuntimeRef | null>(null);

/** Ref to the session runtime. Read `.current` inside frame callbacks / handlers, not during render. */
export function useRuntimeRef(): RuntimeRef {
  const r = useContext(RuntimeContext);
  if (!r) throw new Error("useRuntimeRef outside RuntimeContext");
  return r;
}
