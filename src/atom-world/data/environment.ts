/**
 * Ground-floor layout of ATOM GAME CLUB, in metres.
 *
 * ⚠️ TEMPORARY LAYOUT. No floor plan exists yet: every size and position below is estimated from the
 * reference photos in /public/atom-world/references (see docs/ASSETS.md for which photo each item
 * comes from). Replace these numbers once a measured plan is available — the 3D scene, colliders and
 * mini-map are all generated from this file.
 *
 * Axes: looking from the entrance into the hall, +x is to the right, -z is "inwards", y is up.
 * The glass entrance façade is at z = +HALL.halfLength, the back wall at z = -HALL.halfLength.
 */

export type Vec3 = [number, number, number];

export interface Box {
  min: Vec3;
  max: Vec3;
  /** Collision category. */
  tag: "wall" | "glass" | "furniture" | "machine" | "stairs" | "barrier" | "slab";
  /** Whether the third-person camera is pushed in by this box (default true). */
  camera?: boolean;
}

export const HALL = {
  width: 9,
  halfWidth: 4.5,
  length: 26,
  halfLength: 13,
  height: 5.6,
  wallThickness: 0.3,
  /** Light marble-look cladding on the lower part of the walls. */
  wainscot: 1.5,
  /** ATOM GAME CLUB branding strip just above the cladding. */
  stripHeight: 0.26,
} as const;

/** Upper floor (mezzanine) over the back part of the hall. Walkable in phase 2. */
export const MEZZANINE = { zBack: -HALL.halfLength, zFront: -4.0, top: 2.9, thickness: 0.3 } as const;

/** Open-riser black staircase along the right wall, rising towards the back. */
export const STAIRS = {
  xMin: 3.35,
  xMax: HALL.halfWidth,
  /** z of the front edge of the first step. */
  zStart: 0.2,
  steps: 15,
  run: 0.28,
  tread: 0.06,
  get rise() {
    return MEZZANINE.top / this.steps;
  },
} as const;

export interface PlacedItem {
  id: string;
  x: number;
  z: number;
  /** Rotation around y, radians. */
  rotY?: number;
}

/** Air-hockey tables: long side faces the hall entrance (as in the photos). */
export const AIR_HOCKEY_TABLES: PlacedItem[] = [
  { id: "air-hockey-1", x: -1.3, z: 5.2 },
  { id: "air-hockey-2", x: -1.3, z: 0.6 },
  { id: "air-hockey-3", x: -1.3, z: -3.2 },
];
export const AIR_HOCKEY_SIZE = { x: 2.3, z: 1.25, height: 0.8 } as const;

/** White & gold lounge by the entrance, under the lamppost mural. */
export const LOUNGE = {
  sofa: { x: -4.0, z: 9.5, length: 2.2, depth: 0.9 },
  armchair: { x: -4.0, z: 7.65, width: 0.85, depth: 0.85 },
  table: { x: -2.75, z: 8.6, radius: 0.4 },
} as const;

/** Shop counter with the ATOM badge (right side, in front of the stairs). */
export const COUNTER = { xMin: 2.9, xMax: 3.5, zMin: 1.2, zMax: 5.0, height: 1.05 } as const;
export const SHELF = { xMin: 4.1, xMax: HALL.halfWidth, zMin: 2.4, zMax: 4.9, height: 2.0 } as const;
export const FRIDGE = { xMin: 3.85, xMax: HALL.halfWidth, zMin: 1.35, zMax: 2.1, height: 1.95 } as const;

/** Kids' carpet beside / under the staircase. */
export const KIDS_CARPET = { xMin: 1.5, xMax: 3.3, zMin: -3.8, zMax: -0.5 } as const;
/**
 * The spot under the stairs. It held a small wooden desk; the owner put the face-painting table there
 * instead (2026-10-29), as a movable item (environments/amusement/items.ts).
 */
export const UNDER_STAIR = { xMin: 3.55, xMax: 4.4, zMin: -3.6, zMax: -2.6 } as const;

/** Wooden folding table + chair near the front right. */
export const FOLDING_TABLE = { x: 3.2, z: 7.6, size: 0.8 } as const;

/** Dark pilasters (columns) projecting from the side walls. */
export const PILASTERS: { side: "left" | "right"; z: number }[] = [
  { side: "left", z: 7.65 },
  { side: "left", z: 3.15 },
  { side: "right", z: 7.65 },
  { side: "right", z: -4.3 },
];
export const PILASTER_SIZE = { depth: 0.3, width: 0.5 } as const;

/** Potted plants inside the glass façade (seen in the photos next to the windows). */
export const PLANTS: { x: number; z: number }[] = [
  { x: -4.05, z: 12.45 },
  { x: -1.4, z: 12.5 },
];

/** Second white & gold sofa, inside on the right of the doorway (entrance/exterior-facade-night.jpg). */
export const RIGHT_SOFA = { x: 4.0, z: 10.6, length: 1.9, depth: 0.85 } as const;

/** Wooden door in the back wall under the mezzanine: walk through it to the construction-machines zone. */
export const ZONE_DOOR = { x: 1.6, width: 0.95, height: 2.1 } as const;

/** Open doorway in the façade, on the right of the shop window (entrance/exterior-facade-night.jpg). */
export const ENTRANCE_DOOR = { xMin: 2.0, xMax: 4.4, height: 2.6 } as const;

/** Wall paintings on the left wall, in order from the entrance inwards (textures under /atom-world/textures). */
export interface Mural {
  id: string;
  texture: string;
  /** Centre along the wall (z), width along z, vertical range. */
  z: number;
  width: number;
  yMin: number;
  yMax: number;
  source: string;
}
export const MURALS: Mural[] = [
  {
    id: "lamppost-man",
    texture: "/atom-world/textures/mural-lamppost-man.webp",
    z: 9.95,
    width: 3.9,
    yMin: 1.78,
    yMax: 5.58,
    source: "entrance/entrance-glass-white-sofas.jpg",
  },
  {
    id: "batman-joker",
    texture: "/atom-world/textures/mural-batman-joker.webp",
    z: 5.35,
    width: 3.8,
    yMin: 1.78,
    yMax: 5.58,
    source: "entrance/entrance-glass-white-sofas.jpg",
  },
  {
    id: "woman-lamp",
    texture: "/atom-world/textures/mural-woman-lamp.webp",
    z: -1.1,
    width: 5.7,
    yMin: 2.0,
    yMax: 4.12,
    source: "ground-floor/air-hockey-left-wall.jpg",
  },
];
export const CLOCK = { z: 2.3, y: 4.3 } as const;

/** Just inside the glass door, far enough from the façade for the camera to sit behind the player. */
export const SPAWN = { x: 0.6, z: 8.4, heading: Math.PI } as const;

/** Interactables: one entry per physical machine, all pointing at a machine id in data/machines.ts. */
/**
 * Virtual tournaments & events board (phase 11): a hologram in front of the counter. It is NOT a
 * real object of the club (none appears in the photos) — drawn as a floating glowing panel so it
 * reads as part of the game, not of the building.
 */
export const EVENTS_BOARD = { x: 1.95, z: 6.3, y: 1.6, width: 1.5, height: 0.95, heading: Math.PI * 0.12 } as const;

/** Fixed interactables (air-hockey tables and the events board are movable items: amusement/items.ts). */
export const INTERACTABLES: { id: string; machineId: string; position: Vec3; radius: number }[] = [
  { id: "shop-counter", machineId: "shop-counter", position: [COUNTER.xMin - 0.1, 1.0, (COUNTER.zMin + COUNTER.zMax) / 2], radius: 1.7 },
];

export function box(min: Vec3, max: Vec3, tag: Box["tag"], camera = true): Box {
  return { min, max, tag, camera };
}

/** All static colliders of the ground floor. `stairsOpen: false` closes the stairs (phase-1 barrier). */
export function buildGroundFloorColliders({ stairsOpen = true }: { stairsOpen?: boolean } = {}): Box[] {
  const { halfWidth: hw, halfLength: hl, height: h, wallThickness: t } = HALL;
  const out: Box[] = [
    // Shell
    box([-hw - t, 0, -hl - t], [-hw, h, hl + t], "wall"),
    box([hw, 0, -hl - t], [hw + t, h, hl + t], "wall"),
    box([-hw, 0, -hl - t], [hw, h, -hl], "wall"),
    // glass shop window, left of the doorway (the doorway itself is open)
    box([-hw, 0, hl], [ENTRANCE_DOOR.xMin, h, hl + t], "glass"),
    box([ENTRANCE_DOOR.xMax, 0, hl], [hw, h, hl + t], "wall"),
    box([ENTRANCE_DOOR.xMin, ENTRANCE_DOOR.height, hl], [ENTRANCE_DOOR.xMax, h, hl + t], "wall"),
    // Ceiling, and the mezzanine slab (its top is the upper floor)
    box([-hw, h, -hl], [hw, h + t, hl], "slab"),
    box([-hw, MEZZANINE.top - MEZZANINE.thickness, MEZZANINE.zBack], [hw, MEZZANINE.top, MEZZANINE.zFront], "slab"),
  ];

  for (const p of PILASTERS) {
    const x0 = p.side === "left" ? -hw : hw - PILASTER_SIZE.depth;
    out.push(box([x0, 0, p.z - PILASTER_SIZE.width / 2], [x0 + PILASTER_SIZE.depth, h, p.z + PILASTER_SIZE.width / 2], "wall"));
  }

  // movable furniture and machines (air hockey, sofas, tables, plants) are items: amusement/items.ts
  out.push(
    box([COUNTER.xMin, 0, COUNTER.zMin], [COUNTER.xMax, COUNTER.height, COUNTER.zMax], "furniture", false),
    box([SHELF.xMin, 0, SHELF.zMin], [SHELF.xMax, SHELF.height, SHELF.zMax], "furniture", false),
    box([FRIDGE.xMin, 0, FRIDGE.zMin], [FRIDGE.xMax, FRIDGE.height, FRIDGE.zMax], "furniture", false),
  );

  out.push(...buildStairColliders());
  if (!stairsOpen) out.push(box([STAIRS.xMin - 0.05, 0, STAIRS.zStart], [STAIRS.xMax, 1.1, STAIRS.zStart + 0.35], "barrier", false));
  return out;
}

/** Each tread is its own box, so the step-up logic of the character controller can climb them. */
export function buildStairColliders(): Box[] {
  const out: Box[] = [];
  const rise = STAIRS.rise;
  for (let i = 0; i < STAIRS.steps; i++) {
    const top = (i + 1) * rise;
    const zFront = STAIRS.zStart - i * STAIRS.run;
    const zBack = zFront - STAIRS.run;
    // Tread (camera ignores it so the view does not jump while climbing)
    out.push(box([STAIRS.xMin, top - STAIRS.tread, zBack], [STAIRS.xMax, top, zFront], "stairs", false));
    // Railing on the open (hall) side
    out.push(box([STAIRS.xMin - 0.04, top, zBack], [STAIRS.xMin + 0.02, top + 0.95, zFront], "stairs", false));
  }
  return out;
}
