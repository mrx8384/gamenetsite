import type { Box } from "../data/environment";
import { amusement } from "../environments/amusement";
import { slotText } from "./slots";
import { constructionZone } from "../environments/construction-zone";
import { gamingCenter } from "../environments/gaming-center";
import type { Surface } from "../systems/AudioManager";
import { type ItemChanges, itemColliders, itemInteractable, NO_CHANGES, resolveItems, type WorldItem } from "./items";
import type { EnvironmentDef, Interactable, PortalDef, Spawn, TravelTarget } from "./types";

/**
 * All environments of ATOM World. To add one: create `environments/<id>/index.ts` + `Scene.tsx`
 * and add it to this list (docs/ENVIRONMENTS.md).
 * The character, camera, collisions, interactions, menus and mini-games need no change.
 * The first entry is where a session starts.
 */
export const ENVIRONMENTS: EnvironmentDef[] = [amusement, constructionZone, gamingCenter];

export const START_ENV = ENVIRONMENTS[0].id;

export function envById(id: string, list = ENVIRONMENTS): EnvironmentDef | undefined {
  return list.find((e) => e.id === id);
}

const inside = (e: EnvironmentDef, x: number, z: number) => x >= e.bounds.xMin && x <= e.bounds.xMax && z >= e.bounds.zMin && z <= e.bounds.zMax;

/** Environment that owns a point (by its bounds). */
export function envAt(x: number, z: number, list = ENVIRONMENTS): EnvironmentDef {
  return list.find((e) => inside(e, x, z)) ?? list[0];
}

/** Distance from a point to an environment's rectangle (0 inside). */
export function distanceToEnv(e: EnvironmentDef, x: number, z: number) {
  const dx = Math.max(e.bounds.xMin - x, 0, x - e.bounds.xMax);
  const dz = Math.max(e.bounds.zMin - z, 0, z - e.bounds.zMax);
  return Math.hypot(dx, dz);
}

/**
 * How far a point is from an environment for preloading: the nearer of its own rectangle and any
 * doorway of another environment that leads into it (a basement reached by a street door is far
 * away in world space, but its scene should start loading as the player walks up to that door).
 */
export function preloadDistanceTo(e: EnvironmentDef, x: number, z: number, list = ENVIRONMENTS) {
  let d = distanceToEnv(e, x, z);
  for (const other of list) {
    if (other.id === e.id) continue;
    for (const p of other.portals) if (p.to.env === e.id) d = Math.min(d, Math.hypot(x - p.at[0], z - p.at[2]));
  }
  return d;
}

/** The environment an area id belongs to. */
export function envOfArea(area: string, list = ENVIRONMENTS): EnvironmentDef | undefined {
  return list.find((e) => area in e.areaLabels);
}

/** Floor height of an item's level. */
export function itemY(item: WorldItem, list = ENVIRONMENTS) {
  return envById(item.env, list)?.levels.find((l) => l.id === item.level)?.y ?? 0;
}

// the manager's changes (admin editor), applied before a session starts
let changes: ItemChanges = NO_CHANGES;
const resolvedCache = new WeakMap<EnvironmentDef[], { changes: ItemChanges; items: WorldItem[] }>();

/** Applies the manager's item changes (move / turn / hide / add) for the next session. */
export function setItemChanges(c: ItemChanges) {
  changes = c;
}

export function currentItemChanges() {
  return changes;
}

/** Every item of the world: built-in ones with the manager's changes, and the added ones. */
export function worldItems(list = ENVIRONMENTS): WorldItem[] {
  const hit = resolvedCache.get(list);
  if (hit && hit.changes === changes) return hit.items;
  const items = resolveItems(
    list.flatMap((e) => e.items),
    { items: changes.items, added: changes.added.filter((a) => list.some((e) => e.id === a.env)) },
  );
  resolvedCache.set(list, { changes, items });
  return items;
}

export function buildWorldColliders(list = ENVIRONMENTS): Box[] {
  return [...list.flatMap((e) => e.colliders()), ...worldItems(list).flatMap((i) => itemColliders(i, itemY(i, list)))];
}

export function worldBaseFloor(x: number, z: number, list = ENVIRONMENTS) {
  return envAt(x, z, list).baseFloor?.(x, z) ?? 0;
}

/** Machine id used by a portal's interaction marker / prompt. */
export const portalMachineId = (p: PortalDef) => `portal:${p.id}`;

export function allPortals(list = ENVIRONMENTS): PortalDef[] {
  return list.flatMap((e) => e.portals);
}

/** Every interactable: machines of all environments plus their doorways. */
export function worldInteractables(list = ENVIRONMENTS): Interactable[] {
  const items = worldItems(list)
    .map((i) => itemInteractable(i, itemY(i, list)))
    .filter((i): i is Interactable => i !== null);
  return [...list.flatMap((e) => e.interactables), ...items, ...allPortals(list).map((p) => ({ id: p.id, machineId: portalMachineId(p), position: p.at, radius: p.promptRadius ?? p.radius }))];
}

/** Area id is "<env>" or a finer one inside it ("ground", "upper"…); unique across environments. */
export function areaAt(x: number, y: number, z = 0, list = ENVIRONMENTS): string {
  return envAt(x, z, list).areaAt(x, y, z);
}

export function areaLabel(area: string, list = ENVIRONMENTS): string {
  for (const e of list) if (area in e.areaLabels) return slotText(`area:${area}`, e.areaLabels[area]);
  return "";
}

export function surfaceAt(x: number, y: number, z: number, onStairs: boolean, list = ENVIRONMENTS): Surface {
  return envAt(x, z, list).surfaceAt?.(x, y, z, onStairs) ?? (onStairs ? "stairs" : "tile");
}

export function resolveSpawn(t: TravelTarget, list = ENVIRONMENTS): Spawn | null {
  const e = envById(t.env, list);
  if (!e) return null;
  return e.spawns[t.spawn ?? "default"] ?? e.spawns.default;
}

/** Walk-through doorways the player is standing in (travel without a key press). */
export function walkThroughPortalAt(x: number, y: number, z: number, list = ENVIRONMENTS): PortalDef | null {
  for (const p of allPortals(list)) {
    if (!p.walkThrough) continue;
    if (Math.hypot(x - p.at[0], z - p.at[2]) < p.radius && Math.abs(y - p.at[1]) < 2.5) return p;
  }
  return null;
}

/**
 * Consistency checks (run by the unit tests for the real list, and usable for a new environment):
 * unique ids, non-overlapping bounds, a default spawn inside its own bounds, colliders and
 * interactables inside the bounds, every portal going to an existing environment and spawn,
 * every area id labelled.
 */
export function validateEnvironments(list: EnvironmentDef[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const e of list) {
    if (ids.has(e.id)) errors.push(`${e.id}: duplicate id`);
    ids.add(e.id);
    if (!e.spawns.default) errors.push(`${e.id}: no default spawn`);
    for (const [name, s] of Object.entries(e.spawns)) if (!inside(e, s.x, s.z)) errors.push(`${e.id}: spawn "${name}" outside its bounds`);
    for (const i of e.interactables) if (!inside(e, i.position[0], i.position[2])) errors.push(`${e.id}: interactable "${i.id}" outside its bounds`);
    for (const i of e.items) {
      if (!inside(e, i.x, i.z)) errors.push(`${e.id}: item "${i.id}" outside its bounds`);
      if (i.env !== e.id) errors.push(`${e.id}: item "${i.id}" belongs to "${i.env}"`);
      if (!e.levels.some((l) => l.id === i.level)) errors.push(`${e.id}: item "${i.id}" on unknown level "${i.level}"`);
    }
    if (e.levels.length === 0) errors.push(`${e.id}: no floor level`);
    for (const b of e.colliders()) if (!inside(e, b.min[0], b.min[2]) || !inside(e, b.max[0], b.max[2])) errors.push(`${e.id}: a collider is outside its bounds`);
    for (const p of e.portals) {
      if (!inside(e, p.at[0], p.at[2])) errors.push(`${e.id}: portal "${p.id}" outside its bounds`);
      const to = list.find((t) => t.id === p.to.env);
      if (!to) errors.push(`${e.id}: portal "${p.id}" goes to unknown environment "${p.to.env}"`);
      else if (p.to.spawn && !to.spawns[p.to.spawn]) errors.push(`${e.id}: portal "${p.id}" goes to unknown spawn "${p.to.spawn}"`);
    }
    const s = e.spawns.default;
    if (s) {
      const area = e.areaAt(s.x, s.y, s.z);
      if (!(area in e.areaLabels)) errors.push(`${e.id}: area "${area}" has no label`);
    }
  }
  const itemIds = new Set<string>();
  for (const it of list.flatMap((e) => e.items)) {
    if (itemIds.has(it.id)) errors.push(`item id "${it.id}" is used twice`);
    itemIds.add(it.id);
  }
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i].bounds;
      const b = list[j].bounds;
      if (a.xMin < b.xMax && b.xMin < a.xMax && a.zMin < b.zMax && b.zMin < a.zMax) errors.push(`${list[i].id} and ${list[j].id}: bounds overlap`);
    }
  return errors;
}
