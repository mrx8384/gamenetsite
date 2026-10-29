import { BACK_OPENING } from "./environment";

/**
 * 🚜 Construction-machines zone, after construction-zone/construction-zone.jpg.
 *
 * Placed by the owner (2026-10-29) right behind the hall's back wall: its front wall is the hall's back
 * wall, and the open doorway BACK_OPENING (data/environment.ts) leads straight in — no door, no travel.
 *
 * Local axes: looking at the sand pit from the visitor side, +x right, -z towards the mural wall.
 * The visitor stands in front of the white counter; the RC machines are toy scale (≈1:14).
 */
// the room's front wall (local zMax = 4.2) is the outer face of the hall's back wall (z = −13.3)
export const ZONE_ORIGIN = { x: -1.8, z: -17.5 } as const;

/** Room walls (local). */
export const ZONE_ROOM = { xMin: -2.2, xMax: 4.2, zMin: -3, zMax: 4.2, height: 3.0 } as const;

/** Sand pit inside the counters, and its sand surface height. */
export const PIT = { xMin: -2.2, xMax: 1.6, zMin: -3, zMax: 0.4, surface: 0.55 } as const;

/** White counters around the pit (front and right side). */
export const PIT_COUNTERS = [
  { xMin: -2.2, xMax: 2.3, zMin: 0.4, zMax: 0.9 },
  { xMin: 1.6, xMax: 2.3, zMin: -3, zMax: 0.4 },
] as const;
export const COUNTER_TOP = 0.95;

/** Wood-panelled wall behind the right counter. */
export const ZONE_WOOD_WALL = { x: 2.3, zMin: -3, zMax: -0.2, height: 2.4 } as const;

/** Excavator wall painting on the back wall. */
export const EXCAVATOR_MURAL = { x: -0.3, width: 1.95, yMin: 1.5, yMax: 2.72 } as const;

/** Dark-soil ridge on the left (triangle, local x/z) with curbs along its edge. */
export const DARK_RIDGE: [number, number][] = [
  [-2.2, -3],
  [-0.35, -3],
  [-2.2, 0.15],
];
export const RIDGE_TOP = 0.74;

/** Machines and details seen in the photo (local). */
export const ZONE_PROPS = {
  tireRing: { x: 0.0, z: -0.85, r: 0.42 },
  darkMound: { x: 1.15, z: -2.45, r: 0.5 },
  sandPile: { x: 0.3, z: -2.6, r: 0.38 },
  excavatorLeft: { x: -1.35, z: 0.05, rotY: 0.5 },
  excavatorRight: { x: 1.15, z: -0.8, rotY: -2.4 },
  trucks: [
    { x: -0.1, z: -2.75, rotY: 0.2, color: "#f2b705" },
    { x: 0.05, z: -2.55, rotY: 0.05, color: "#f29f05" },
    { x: 0.45, z: -2.7, rotY: -0.3, color: "#d62828" },
  ],
  bridge: { x: -1.6, z: -1.9, rotY: 0.55 },
  shovel: { x: -2.05, z: -1.4 },
  bucket: { x: 2.0, z: 0.1 },
} as const;

/** Where the player appears in the zone (menu travel). */
export const ZONE_SPAWN = { x: -0.2, z: 2.6, heading: Math.PI } as const;
/** The doorway from the hall in local x (the gap in the room's front wall). */
export const ZONE_OPENING = { xMin: BACK_OPENING.xMin - ZONE_ORIGIN.x, xMax: BACK_OPENING.xMax - ZONE_ORIGIN.x, height: BACK_OPENING.height } as const;

export function zoneToWorld(x: number, z: number): [number, number] {
  return [ZONE_ORIGIN.x + x, ZONE_ORIGIN.z + z];
}

export const ZONE_INTERACTABLES = [
  {
    id: "construction-zone",
    machineId: "construction-machines",
    position: [ZONE_ORIGIN.x - 0.3, 1.0, ZONE_ORIGIN.z + 0.9] as [number, number, number],
    radius: 2.2,
  },
];
