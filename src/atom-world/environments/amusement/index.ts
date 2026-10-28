import { buildGroundFloorColliders, HALL, INTERACTABLES, KIDS_CARPET, type Box, box, ZONE_DOOR } from "../../data/environment";
import { baseFloorAt, buildExteriorColliders, FACADE_Z, ROAD, SIDEWALK, STAIR_DOOR, STREET_SPAWN, STREET_Y } from "../../data/exterior";
import { EDGE, FOOT_POOL, SCORE_STOOL, UPPER_INTERACTABLES, UPPER_Y, WOOD_PILLAR } from "../../data/upperFloor";
import { AMUSEMENT_ITEMS } from "./items";
import type { EnvironmentDef } from "../../world/types";

/**
 * 🎡 The amusement hall (شهربازی): street & entrance, ground floor, upper floor — after the photos
 * in public/atom-world/references/{entrance,ground-floor,upper-floor}.
 */
export function buildUpperFloorColliders(): Box[] {
  const y = UPPER_Y;
  const out: Box[] = [
    // safety net + railing along the mezzanine edge (see-through: camera passes)
    box([EDGE.xMin, y, EDGE.z - 0.12], [EDGE.xMax, HALL.height, EDGE.z + 0.02], "wall", false),
    box([FOOT_POOL.xMin, y, FOOT_POOL.zMin], [FOOT_POOL.xMax, y + FOOT_POOL.height, FOOT_POOL.zMax], "machine", false),
    box([WOOD_PILLAR.xMin, y, WOOD_PILLAR.zMin], [WOOD_PILLAR.xMax, HALL.height, WOOD_PILLAR.zMax], "wall"),
    box([SCORE_STOOL.x - 0.22, y, SCORE_STOOL.z - 0.22], [SCORE_STOOL.x + 0.22, y + 0.5, SCORE_STOOL.z + 0.22], "furniture", false),
  ];
  // FOOTBALLS tables and the grey sofa are movable items (./items.ts)
  return out;
}

export const amusement: EnvironmentDef = {
  id: "amusement",
  name: "سالن شهربازی",
  bounds: { xMin: -16, xMax: 16, zMin: -16, zMax: 28 },
  colliders: () => [...buildGroundFloorColliders(), ...buildExteriorColliders(), ...buildUpperFloorColliders()],
  baseFloor: baseFloorAt,
  interactables: [...INTERACTABLES, ...UPPER_INTERACTABLES],
  levels: [
    { id: "ground", y: 0, label: "طبقهٔ همکف", view: { xMin: -5.2, xMax: 5.2, zMin: -13.6, zMax: 15.5 } },
    { id: "upper", y: UPPER_Y, label: "طبقهٔ دوم", view: { xMin: -5.2, xMax: 5.2, zMin: -13.6, zMax: -3.2 } },
  ],
  items: AMUSEMENT_ITEMS,
  spawns: {
    // the game starts on the sidewalk in front of the entrance steps
    default: { x: STREET_SPAWN.x, y: STREET_Y, z: STREET_SPAWN.z, heading: STREET_SPAWN.heading },
    // inside, next to the counter (where you arrive from places that have no confirmed doorway yet)
    counter: { x: 1.6, y: 0, z: 3.0, heading: Math.PI },
    // on the sidewalk in front of the gaming-center door, looking along the street towards the hall
    // in front of the back-wall door, coming back from the construction-machines zone
    "zone-door": { x: ZONE_DOOR.x, y: 0, z: -HALL.halfLength + 1.3, heading: 0 },
    "gaming-door": { x: (STAIR_DOOR.xMin + STAIR_DOOR.xMax) / 2, y: STREET_Y, z: FACADE_Z + 1.5, heading: -Math.PI / 2 },
  },
  portals: [
    // the wooden door at the back of the ground floor: the construction-machines zone (walk in)
    {
      id: "zone-door",
      kind: "door",
      at: [ZONE_DOOR.x, 1, -HALL.halfLength + 0.35],
      radius: 0.6,
      promptRadius: 1.9,
      to: { env: "construction-zone", spawn: "from-hall" },
      prompt: "🚜 ورود به ماشین‌آلات راه‌سازی",
      walkThrough: true,
    },
    // the street door under the orange sign: stairs down to the gaming center (walk in)
    {
      id: "gc-street-door",
      kind: "stairs",
      at: [(STAIR_DOOR.xMin + STAIR_DOOR.xMax) / 2, STREET_Y + 1, FACADE_Z + 0.35],
      radius: 0.6,
      promptRadius: 1.9,
      to: { env: "gaming-center", spawn: "from-street" },
      prompt: "🎮 پایین رفتن به گیم‌نت",
      walkThrough: true,
    },
  ],
  // inside the hall (both floors), or on the sidewalk / road in front of it
  walkable: (x, z) =>
    (Math.abs(x) < HALL.halfWidth && z > -HALL.halfLength && z <= FACADE_Z + 0.01) || (x > SIDEWALK.xMin && x < SIDEWALK.xMax && z >= FACADE_Z - 0.01 && z < ROAD.zMax),
  areaAt: (_x, y, z) => (z > FACADE_Z - 0.05 ? "street" : y > UPPER_Y - 0.4 ? "upper" : "ground"),
  areaLabels: { street: "ورودی مجموعه", ground: "طبقهٔ همکف", upper: "طبقهٔ دوم" },
  surfaceAt: (x, y, z, onStairs) => {
    if (onStairs) return y < 0 ? "street" : "stairs";
    if (z > FACADE_Z - 0.05) return "street";
    if (y < 0.05 && x > KIDS_CARPET.xMin && x < KIDS_CARPET.xMax && z > KIDS_CARPET.zMin && z < KIDS_CARPET.zMax) return "carpet";
    return "tile";
  },
  scene: () => import("./Scene"),
  load: "initial",
  assets: ["textures/*", "photos/*", "models/*"],
};
