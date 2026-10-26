/**
 * Upper floor (mezzanine) layout, in metres, same axes as data/environment.ts.
 *
 * ⚠️ TEMPORARY LAYOUT, estimated from upper-floor/foot-pool-field-and-mural.jpg and
 * upper-floor/footballs-tables-gray-sofa.jpg. Only two photos exist, so wall-art placement on the
 * side walls and all positions are approximate.
 */
import { HALL, MEZZANINE, STAIRS } from "./environment";

/** Floor height of the upper level. */
export const UPPER_Y = MEZZANINE.top;

/** Big floor-pool field: navy felt, white side modules with grey tops, six orange-lit pockets. */
export const FOOT_POOL = {
  xMin: -4.3,
  xMax: 0.5,
  zMin: -12.85,
  zMax: -9.55,
  border: 0.42,
  height: 0.45,
} as const;

/** Wood-clad column next to the field (behind the cage tables). */
export const WOOD_PILLAR = { xMin: 0.8, xMax: 1.6, zMin: -13, zMax: -12.2 } as const;

/** The two "FOOTBALLS" cage tables (long side along z), each with a red-seat cage stool in front. */
export const FOOTBALLS_TABLES = [
  { id: "footballs-1", x: 1.55, z: -9.7 },
  { id: "footballs-2", x: 2.85, z: -9.2 },
] as const;
export const FOOTBALLS_SIZE = { x: 0.95, z: 1.75, height: 0.82 } as const;
export const CAGE_STOOL = { x: 0.95, z: 0.55, height: 0.46 } as const;
/** Small wooden stool with the flip scoreboard, between the tables. */
export const SCORE_STOOL = { x: 2.2, z: -7.95 } as const;

/** Grey two-seat sofa against the right wall. */
export const GRAY_SOFA = { x: 4.0, z: -10.0, length: 1.7, depth: 0.85 } as const;

/** Wall art: textures rectified from the two photos. */
export interface UpperMural {
  id: string;
  texture: string;
  wall: "back" | "left" | "right";
  /** Centre along the wall (x for the back wall, z for side walls) and size. */
  at: number;
  width: number;
  yMin: number;
  yMax: number;
}
export const UPPER_MURALS: UpperMural[] = [
  // behind the field (photo is foreshortened: stretched 1.5× vertically)
  { id: "back-hearts", texture: "/atom-world/textures/mural-upper-back.webp", wall: "back", at: -1.9, width: 5.2, yMin: UPPER_Y + 0.5, yMax: UPPER_Y + 2.1 },
  { id: "back-dice", texture: "/atom-world/textures/mural-upper-dice.webp", wall: "back", at: 3.05, width: 2.9, yMin: UPPER_Y + 0.25, yMax: UPPER_Y + 1.96 },
  { id: "left-cards", texture: "/atom-world/textures/mural-upper-cards.webp", wall: "left", at: -10.9, width: 3.7, yMin: UPPER_Y + 0.05, yMax: UPPER_Y + 2.62 },
  { id: "left-dice", texture: "/atom-world/textures/mural-upper-dice.webp", wall: "left", at: -6.6, width: 4.3, yMin: UPPER_Y + 0.05, yMax: UPPER_Y + 2.6 },
  { id: "right-cards", texture: "/atom-world/textures/mural-upper-cards.webp", wall: "right", at: -10.6, width: 3.7, yMin: UPPER_Y + 0.05, yMax: UPPER_Y + 2.62 },
];

export const UPPER_INTERACTABLES = [
  {
    id: "foot-pool",
    machineId: "foot-pool",
    position: [(FOOT_POOL.xMin + FOOT_POOL.xMax) / 2, UPPER_Y + 0.9, FOOT_POOL.zMax] as [number, number, number],
    radius: 2.4,
  },
  // the FOOTBALLS tables are movable items (amusement/items.ts)
];

/** Net + railing along the mezzanine edge, leaving the stair opening free. */
export const EDGE = { xMin: -HALL.halfWidth, xMax: STAIRS.xMin, z: MEZZANINE.zFront } as const;
