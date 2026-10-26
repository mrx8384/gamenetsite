/**
 * Street side of ATOM GAME CLUB, after entrance/exterior-facade-night.jpg (the only exterior photo).
 * The hall floor is about four steps above the sidewalk. Sizes are estimated from that photo.
 */
import { type Box, box, ENTRANCE_DOOR, HALL } from "./environment";

export const FACADE_Z = HALL.halfLength + HALL.wallThickness; // outer face of the shop front
export const STREET_Y = -0.68;
export const STEP = { count: 4, rise: -STREET_Y / 4, run: 0.3 } as const;
export const SIDEWALK = { xMin: -12, xMax: 12, zMax: FACADE_Z + 4.2 } as const;
export const ROAD = { zMin: SIDEWALK.zMax, zMax: SIDEWALK.zMax + 8 } as const;

/** Steps in front of the doorway, a bit wider than the opening. */
export const STEPS = { xMin: ENTRANCE_DOOR.xMin - 0.15, xMax: ENTRANCE_DOOR.xMax + 0.1 } as const;

/** Residential door of the building (white slatted) and the lit «اتم گیم کلاب» sign above it. */
export const BUILDING_DOOR = { xMin: 5.6, xMax: 8.2, height: 3.3 } as const;
export const SIGN = { xMin: 4.75, xMax: 12, yMin: 3.6, yMax: 5.2 } as const;
/**
 * Open doorway right of the slatted door, also under the sign: stairs down to the gaming center
 * (gaming-center/15-street-facade-sign.jpg, 14-entrance-door-stairs-from-street.jpg).
 */
export const STAIR_DOOR = { xMin: 8.6, xMax: 9.9, height: 2.5 } as const;

/** Wire cage (outdoor AC unit) under the shop window, and the street lamp. */
export const CAGE = { xMin: -4.3, xMax: -0.3, depth: 0.5 } as const;
export const LAMP_POST = { x: -5.4, z: FACADE_Z + 0.7 } as const;

/** Where the game starts: on the sidewalk, facing the entrance steps. */
export const STREET_SPAWN = { x: (ENTRANCE_DOOR.xMin + ENTRANCE_DOOR.xMax) / 2, z: FACADE_Z + 3.4, heading: Math.PI } as const;

/** Sidewalk height for points outside the façade (used as the base floor by the collision world). */
export function baseFloorAt(x: number, z: number): number {
  return z > FACADE_Z && x > SIDEWALK.xMin - 1 && x < SIDEWALK.xMax + 1 ? STREET_Y : 0;
}

export function buildExteriorColliders(): Box[] {
  const z0 = HALL.halfLength;
  const out: Box[] = [
    // façade outside the hall width
    box([SIDEWALK.xMin, STREET_Y, z0], [-HALL.halfWidth, 12, FACADE_Z], "wall"),
    box([HALL.halfWidth, STREET_Y, z0], [SIDEWALK.xMax, 12, FACADE_Z], "wall"),
    // invisible limits of the playable street area
    box([SIDEWALK.xMin - 0.3, STREET_Y, FACADE_Z], [SIDEWALK.xMin, 6, ROAD.zMax], "wall", false),
    box([SIDEWALK.xMax, STREET_Y, FACADE_Z], [SIDEWALK.xMax + 0.3, 6, ROAD.zMax], "wall", false),
    box([SIDEWALK.xMin, STREET_Y, ROAD.zMax], [SIDEWALK.xMax, 6, ROAD.zMax + 0.3], "wall", false),
    // AC cage under the window, lamp post
    box([CAGE.xMin, STREET_Y, FACADE_Z], [CAGE.xMax, 0, FACADE_Z + CAGE.depth], "furniture", false),
    box([LAMP_POST.x - 0.15, STREET_Y, LAMP_POST.z - 0.15], [LAMP_POST.x + 0.15, 3, LAMP_POST.z + 0.15], "furniture", false),
  ];
  // steps: top of step k (k = 1 is the lowest) is STREET_Y + k·rise; the last one ends at the threshold
  for (let k = 1; k < STEP.count; k++) {
    const zFront = FACADE_Z + (STEP.count - k) * STEP.run;
    out.push(box([STEPS.xMin, STREET_Y, FACADE_Z], [STEPS.xMax, STREET_Y + k * STEP.rise, zFront], "stairs", false));
  }
  // threshold inside the wall thickness is at hall level
  out.push(box([ENTRANCE_DOOR.xMin, STREET_Y, z0], [ENTRANCE_DOOR.xMax, 0, FACADE_Z], "stairs", false));
  return out;
}
