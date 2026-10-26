/**
 * 🎮 Gaming center (گیم‌نت) in the basement of ATOM GAME CLUB, after the owner's 15 photos in
 * public/atom-world/references/gaming-center (see its README for what each photo shows).
 *
 * ⚠️ APPROXIMATE LAYOUT. There is no measured plan (the owner has none). The order of the walls,
 * murals, doors and station numbers follows the photos; sizes are estimated from them (ceiling
 * ≈ 2.9 m, 60 cm floor tiles, sofas ≈ 1.9 m). Correct the numbers here when better information
 * arrives — the scene, colliders, interactions and map are all generated from this file.
 *
 * What the owner confirmed: station 1 is a PS5, stations 2–13 are PS4 (twelve); the train-mural
 * room is part of the gaming center and holds station 13; the entrance is the street door under the
 * orange «اتم گیم کلاب» sign, with stairs going down (photos 13–15), and coming in from the stairs the
 * counter is on your right — so the stair door is in the counter's wall, just east of it.
 * Not seen in any photo (not drawn): number signs for stations 1 and 13.
 *
 * Local axes (metres): +x east, +z south, y up, y = 0 on the basement floor. Facing the counter you
 * look north (-z). World position = GC_ORIGIN + local.
 */
export const GC_ORIGIN = { x: 80, z: 0 } as const;

export const GC_HEIGHT = 2.9;
export const WALL_T = 0.2;

/** Rooms (local). */
export const ROOMS = {
  hall: { xMin: -5, xMax: 5, zMin: -7, zMax: 7 },
  /** Through the door left of the counter: couple-and-train mural (photos 01, 02). */
  train: { xMin: -5, xMax: -0.6, zMin: -12.2, zMax: -7 },
  /** From the street door down to the hall (photos 13, 14); comes in through the north wall. */
  stairs: { xMin: 2.45, xMax: 3.95, zMin: -15.6, zMax: -7 },
} as const;

/** Openings in the walls (local). */
export const TRAIN_DOOR = { xMin: -4.3, xMax: -3.3, height: 2.1 } as const; // wall z = -7
/** Arch on the black panel (photo 05): a closed decoration — there is no room behind it (owner). */
export const ARCH = { zMin: -2.15, zMax: -1.05, height: 2.25 } as const; // wall x = 5
export const STAIR_DOOR = { xMin: 2.7, xMax: 3.7, height: 2.1 } as const; // wall z = -7, right of the counter seen from the door

/** Stairs from the street: 14 marble steps rising away from the hall (towards -z); zStart = front edge of the lowest. */
export const STAIR_STEPS = { count: 14, zStart: -8.4, run: 0.28, rise: 0.18 } as const;
export const STAIR_TOP_Y = STAIR_STEPS.count * STAIR_STEPS.rise;
export const STAIR_CEILING = 5.3;

/** Counter with purple-lit shelves behind it (photo 03), against the north wall. */
export const COUNTER = { xMin: -2.4, xMax: 1.0, zMin: -5.75, zMax: -5.15, height: 1.05 } as const;
export const SHELVES = { xMin: -2.55, xMax: 1.15, yMin: 0.6, yMax: 2.55 } as const;
export const FRIDGE = { xMin: -3.25, xMax: -2.6, zMin: -6.0, zMax: -5.35, height: 1.9 } as const;

/** Square column in the room, with the blue bin (photo 12). */
export const PILLAR = { x: -2.4, z: 0.2, size: 0.55 } as const;

/** Wall finishes in order along each wall (photos 03–12). z / x ranges are local. */
export const WEST_WALL = {
  stone: { zMin: 4.2, zMax: 7 },
  paris: { zMin: 0.45, zMax: 4.2 },
  pilaster: { zMin: 0, zMax: 0.45, depth: 0.25 },
  portraits: { zMin: -4.6, zMax: 0 },
} as const;
export const EAST_WALL = {
  wood: { zMin: -7, zMax: -2.6 },
  controllers: { zMin: -6.6, zMax: -5.0, yMin: 1.15, yMax: 2.15 },
  chalkboard: { zMin: -4.75, zMax: -3.15, yMin: 1.4, yMax: 2.45 },
  black: { zMin: -2.6, zMax: -0.6 },
  castle: { zMin: -0.6, zMax: 4.6 },
  dark: { zMin: 4.6, zMax: 7 },
} as const;
export const TRAIN_MURAL = { xMin: -4.85, xMax: -1.0 } as const; // on the train room's north wall

export type Console = "ps5" | "ps4";

export interface Station {
  /** Number on the wall sign; null when no sign is seen in the photos. */
  number: number | null;
  console: Console;
  room: "hall" | "train";
  /** TV (centre of its cabinet) and the direction its screen faces (rotation about y). */
  x: number;
  z: number;
  rotY: number;
  /** Draw a 3D number sign on the wall (false where the sign is already in the mural texture). */
  sign?: { x: number; y: number; z: number; rotY: number };
}

const E = -Math.PI / 2; // faces -x (TV on the east wall)
const W = Math.PI / 2; // faces +x (TV on the west wall)

/**
 * Stations with their wall signs as seen: 2 on the wood wall by the chalkboard, 3–4 on the castle
 * mural, 8–10 on the portrait wall, 11–12 on the Paris mural; 5–6 stand opposite the counter.
 * Station 1 (PS5): no sign in the photos; the TV in front of the counter (photos 03, 09).
 * Station 13: the train room's TV (owner), no sign in the photos. No station 7 is seen anywhere.
 */
export const STATIONS: Station[] = [
  { number: 1, console: "ps5", room: "hall", x: 0.3, z: -3.9, rotY: 0 },
  { number: 2, console: "ps4", room: "hall", x: 4.55, z: -3.0, rotY: E, sign: { x: 4.88, y: 1.5, z: -2.35, rotY: E } },
  { number: 3, console: "ps4", room: "hall", x: 4.55, z: 0.9, rotY: E, sign: { x: 4.88, y: 1.5, z: 1.0, rotY: E } },
  { number: 4, console: "ps4", room: "hall", x: 4.55, z: 3.4, rotY: E, sign: { x: 4.88, y: 1.7, z: 3.9, rotY: E } },
  // 5 and 6: opposite the counter, on the south wall (owner: there is no London room)
  { number: 5, console: "ps4", room: "hall", x: 2.6, z: 6.55, rotY: Math.PI, sign: { x: 2.6, y: 1.5, z: 6.88, rotY: Math.PI } },
  { number: 6, console: "ps4", room: "hall", x: 0.2, z: 6.55, rotY: Math.PI, sign: { x: 0.2, y: 1.5, z: 6.88, rotY: Math.PI } },
  { number: 13, console: "ps4", room: "train", x: -2.9, z: -11.75, rotY: 0 },
  { number: 8, console: "ps4", room: "hall", x: -4.45, z: -4.0, rotY: W },
  { number: 9, console: "ps4", room: "hall", x: -4.45, z: -2.3, rotY: W },
  { number: 10, console: "ps4", room: "hall", x: -4.45, z: -0.7, rotY: W },
  { number: 11, console: "ps4", room: "hall", x: -4.45, z: 1.7, rotY: W },
  { number: 12, console: "ps4", room: "hall", x: -4.45, z: 3.3, rotY: W },
];

export const stationId = (s: Station, i: number) => (s.number !== null ? `gc-station-${s.number}` : `gc-station-train-${i}`);

/** Grey tufted sofas with brown side panels (all photos) and metal-frame armchairs. */
export interface Seat {
  /** Stable id (the admin editor's changes refer to it). */
  id: string;
  x: number;
  z: number;
  rotY: number;
  length: number;
}
export const SOFA_DEPTH = 0.88;
export const SOFAS: Seat[] = [
  { id: "gc-sofa-1", x: 0.3, z: -1.7, rotY: Math.PI, length: 1.9 },
  { id: "gc-sofa-2", x: 2.5, z: -3.0, rotY: W, length: 1.9 },
  { id: "gc-sofa-3", x: 2.4, z: 2.15, rotY: W, length: 2.0 },
  { id: "gc-sofa-4", x: -2.3, z: 2.5, rotY: E, length: 2.0 },
  { id: "gc-sofa-5", x: -2.2, z: -1.5, rotY: E, length: 1.9 },
  { id: "gc-sofa-6", x: -2.2, z: -4.3, rotY: E, length: 1.7 },
  { id: "gc-sofa-7", x: -4.4, z: 5.6, rotY: W, length: 1.9 },
  { id: "gc-sofa-10", x: -1.1, z: -10.0, rotY: E, length: 1.6 },
  // facing stations 5 and 6
  { id: "gc-sofa-11", x: 1.4, z: 4.4, rotY: 0, length: 2.0 },
];
export const ARMCHAIRS: Seat[] = [
  { id: "gc-armchair-1", x: -1.15, z: -1.9, rotY: Math.PI - 0.4, length: 0.7 },
  { id: "gc-armchair-2", x: 2.75, z: 0.35, rotY: W + 0.3, length: 0.7 },
  { id: "gc-armchair-4", x: -4.3, z: -10.2, rotY: Math.PI * 0.8, length: 0.7 },
];

/** Where you arrive: top of the stairs (from the street) and inside the stair door. */
export const SPAWN_TOP = { x: 3.2, z: -13.4, heading: 0 } as const;
export const SPAWN_HALL = { x: 3.2, z: -5.6, heading: 0 } as const;
/** Street door at the top of the stairs (walk into it to go back out). */
export const STREET_EXIT = { x: 3.2, z: -15.35, radius: 0.55 } as const;

export const toWorld = (x: number, z: number): [number, number] => [GC_ORIGIN.x + x, GC_ORIGIN.z + z];
