import { box, type Box } from "../../data/environment";
import type { EnvironmentDef, Interactable, MapShape } from "../../world/types";
import { GC_ITEMS } from "./items";
import {
  COUNTER,
  EAST_WALL,
  FRIDGE,
  GC_HEIGHT,
  GC_ORIGIN,
  PILLAR,
  ROOMS,
  SPAWN_HALL,
  SPAWN_TOP,
  STAIR_CEILING,
  STAIR_DOOR,
  STAIR_STEPS,
  STAIR_TOP_Y,
  STREET_EXIT,
  TRAIN_DOOR,
  WALL_T,
  WEST_WALL,
} from "./layout";

/**
 * 🎮 The gaming center (گیم‌نت) in the basement: main hall with the counter and stations 1–4, 8–12,
 * stations 5–6 opposite the counter, the train-mural room (13), and the stairs up to the street
 * door under the orange sign. Approximate layout from the owner's photos — see ./layout.ts.
 */

/** A straight wall in local coordinates: along x at a fixed z ("z"), or along z at a fixed x ("x"). */
export interface WallDef {
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  height: number;
  /** Bottom of the wall (default 0). */
  base?: number;
  /** Doorways, in order along the wall. */
  gaps?: { from: number; to: number; height: number }[];
}

const H = GC_HEIGHT;
const { hall, train, stairs } = ROOMS;

export const WALLS: WallDef[] = [
  {
    axis: "z",
    at: hall.zMin,
    from: hall.xMin,
    to: hall.xMax,
    height: H,
    gaps: [
      { from: TRAIN_DOOR.xMin, to: TRAIN_DOOR.xMax, height: TRAIN_DOOR.height },
      { from: STAIR_DOOR.xMin, to: STAIR_DOOR.xMax, height: STAIR_DOOR.height },
    ],
  },
  { axis: "z", at: hall.zMax, from: hall.xMin, to: hall.xMax, height: H },
  { axis: "x", at: hall.xMin, from: hall.zMin, to: hall.zMax, height: H },
  { axis: "x", at: hall.xMax, from: hall.zMin, to: hall.zMax, height: H },
  { axis: "x", at: train.xMin, from: train.zMin, to: train.zMax, height: H },
  { axis: "z", at: train.zMin, from: train.xMin, to: train.xMax, height: H },
  { axis: "x", at: train.xMax, from: train.zMin, to: train.zMax, height: H },
  { axis: "x", at: stairs.xMin, from: stairs.zMin, to: stairs.zMax, height: STAIR_CEILING },
  { axis: "x", at: stairs.xMax, from: stairs.zMin, to: stairs.zMax, height: STAIR_CEILING },
  { axis: "z", at: stairs.zMin, from: stairs.xMin, to: stairs.xMax, height: STAIR_CEILING },
  // the stair hall is taller than the basement: wall above the stair door
  { axis: "z", at: hall.zMin, from: stairs.xMin, to: stairs.xMax, height: STAIR_CEILING, base: H },
];

/** Axis-aligned footprint of something built facing +z and turned by rotY (multiples of 90° only). */
export function footprint(x: number, z: number, rotY: number, width: number, depth: number) {
  const across = Math.abs(Math.sin(rotY)) > 0.7;
  const hx = (across ? depth : width) / 2;
  const hz = (across ? width : depth) / 2;
  return { xMin: x - hx, xMax: x + hx, zMin: z - hz, zMax: z + hz };
}

export const TV_CABINET = { width: 1.2, depth: 0.45, height: 0.5 } as const;

const ox = GC_ORIGIN.x;
const oz = GC_ORIGIN.z;
const lbox = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tag: Box["tag"], camera = true) => box([ox + x0, y0, oz + z0], [ox + x1, y1, oz + z1], tag, camera);

/** A wall's solid pieces in local coordinates: [x0, y0, z0, x1, y1, z1] (also drawn by the scene). */
export function wallPieces(w: WallDef): [number, number, number, number, number, number][] {
  const t = WALL_T / 2;
  const seg = (a: number, b: number, y0: number, y1: number): [number, number, number, number, number, number] =>
    w.axis === "z" ? [a, y0, w.at - t, b, y1, w.at + t] : [w.at - t, y0, a, w.at + t, y1, b];
  const from = w.from - t;
  const to = w.to + t;
  const y0 = w.base ?? 0;
  const out: [number, number, number, number, number, number][] = [];
  let a = from;
  for (const g of w.gaps ?? []) {
    out.push(seg(a, g.from, y0, w.height), seg(g.from, g.to, g.height, w.height));
    a = g.to;
  }
  out.push(seg(a, to, y0, w.height));
  return out;
}

export function buildGamingCenterColliders(): Box[] {
  const out: Box[] = WALLS.flatMap(wallPieces).map(([x0, y0, z0, x1, y1, z1]) => lbox(x0, y0, z0, x1, y1, z1, "wall"));
  // ceilings (the camera stays inside)
  for (const r of [hall, train]) out.push(lbox(r.xMin, H, r.zMin, r.xMax, H + 0.2, r.zMax, "slab"));
  out.push(lbox(stairs.xMin, STAIR_CEILING, stairs.zMin, stairs.xMax, STAIR_CEILING + 0.2, stairs.zMax, "slab"));
  // stairs: step k (1 = lowest) has its top at k·rise; the last one is the street-level landing
  for (let k = 1; k <= STAIR_STEPS.count; k++) {
    out.push(lbox(stairs.xMin, 0, stairs.zMin, stairs.xMax, k * STAIR_STEPS.rise, STAIR_STEPS.zStart - (k - 1) * STAIR_STEPS.run, "stairs", false));
  }
  // counter (the staff side behind it is closed), fridge, column
  out.push(lbox(COUNTER.xMin, 0, hall.zMin, COUNTER.xMax, COUNTER.height, COUNTER.zMax, "furniture", false));
  out.push(lbox(FRIDGE.xMin, 0, FRIDGE.zMin, FRIDGE.xMax, FRIDGE.height, FRIDGE.zMax, "furniture", false));
  out.push(lbox(PILLAR.x - PILLAR.size / 2, 0, PILLAR.z - PILLAR.size / 2, PILLAR.x + PILLAR.size / 2, H, PILLAR.z + PILLAR.size / 2, "wall"));
  out.push(lbox(hall.xMin, 0, WEST_WALL.pilaster.zMin, hall.xMin + WALL_T / 2 + WEST_WALL.pilaster.depth, H, WEST_WALL.pilaster.zMax, "wall"));
  // stations, sofas and armchairs are movable items (./items.ts)
  return out;
}

/** Each station is walked up to from its screen side. */
/** Fixed interactables (the stations are movable items: ./items.ts). */
export const GC_INTERACTABLES: Interactable[] = [
  { id: "gc-counter", machineId: "gc-counter", position: [ox - 1.3, 1.0, oz + COUNTER.zMax + 0.35], radius: 1.4 },
  { id: "gc-chalkboard", machineId: "gc-tournament-board", position: [ox + hall.xMax - 0.9, 1.0, oz + (EAST_WALL.chalkboard.zMin - 0.1)], radius: 1.0 },
];

export function gamingCenterAreaAt(x: number, _y: number, z: number): string {
  const lx = x - ox;
  const lz = z - oz;
  if (lz < hall.zMin && lx > stairs.xMin - 0.2) return "gc-stairs";
  if (lz < hall.zMin) return "gc-train";
  return "gc-hall";
}

function mapShapes(): MapShape[] {
  const r = (x0: number, z0: number, x1: number, z1: number, fill: string, extra: Partial<Extract<MapShape, { kind: "rect" }>> = {}): MapShape => ({
    kind: "rect",
    x0: ox + x0,
    z0: oz + z0,
    x1: ox + x1,
    z1: oz + z1,
    fill,
    ...extra,
  });
  const text = (x: number, z: number, t: string, size = 0.5, fill = "#111"): MapShape => ({ kind: "text", x: ox + x, z: oz + z, text: t, size, fill });
  const shapes: MapShape[] = [
    r(hall.xMin, hall.zMin, hall.xMax, hall.zMax, "#e9e9e6", { rx: 0.15 }),
    r(train.xMin, train.zMin, train.xMax, train.zMax, "#dcdcd8"),
    r(stairs.xMin, stairs.zMin, stairs.xMax, stairs.zMax, "#c9bfae"),
    r(TRAIN_DOOR.xMin, hall.zMin - 0.1, TRAIN_DOOR.xMax, hall.zMin + 0.1, "#e9e9e6"),
    r(STAIR_DOOR.xMin, hall.zMin - 0.1, STAIR_DOOR.xMax, hall.zMin + 0.1, "#e9e9e6"),
    r(stairs.xMin, stairs.zMin - 0.1, stairs.xMax, stairs.zMin + 0.25, "#39ff88"),
    r(COUNTER.xMin, COUNTER.zMin, COUNTER.xMax, COUNTER.zMax, "#8a5a32", { hot: "gc-counter" }),
    r(FRIDGE.xMin, FRIDGE.zMin, FRIDGE.xMax, FRIDGE.zMax, "#bdbdbd"),
    r(PILLAR.x - PILLAR.size / 2, PILLAR.z - PILLAR.size / 2, PILLAR.x + PILLAR.size / 2, PILLAR.z + PILLAR.size / 2, "#8b8f94"),
  ];
  for (let k = 0; k < STAIR_STEPS.count; k++) {
    const z = STAIR_STEPS.zStart - k * STAIR_STEPS.run;
    shapes.push(r(stairs.xMin, z - 0.04, stairs.xMax, z, "#9a907f"));
  }
  // stations and seats are items: the map draws them from the live item list
  shapes.push(
    text(-0.7, COUNTER.zMax + 0.6, "پیشخوان", 0.45, "#5a3b2e"),
    text((train.xMin + train.xMax) / 2, train.zMax - 0.5, "اتاق قطار", 0.45),
    text((stairs.xMax + 1.5), stairs.zMin + 0.6, "به خیابان", 0.45, "#cfd3cf"),
  );
  return shapes;
}

export const gamingCenter: EnvironmentDef = {
  id: "gaming-center",
  name: "گیم‌نت اتم",
  bounds: { xMin: ox - 8, xMax: ox + 6, zMin: oz - 18, zMax: oz + 9 },
  colliders: buildGamingCenterColliders,
  interactables: GC_INTERACTABLES,
  levels: [{ id: "main", y: 0, label: "گیم‌نت", view: { xMin: ox - 5.5, xMax: ox + 5.5, zMin: oz - 16, zMax: oz + 7.5 } }],
  items: GC_ITEMS,
  spawns: {
    // inside the stair door (menu / list travel)
    default: { x: ox + SPAWN_HALL.x, y: 0, z: oz + SPAWN_HALL.z, heading: SPAWN_HALL.heading },
    // top of the stairs, coming in from the street door
    "from-street": { x: ox + SPAWN_TOP.x, y: STAIR_TOP_Y, z: oz + SPAWN_TOP.z, heading: SPAWN_TOP.heading },
  },
  portals: [
    {
      id: "gc-street-exit",
      kind: "stairs",
      at: [ox + STREET_EXIT.x, STAIR_TOP_Y + 1, oz + STREET_EXIT.z],
      radius: STREET_EXIT.radius,
      promptRadius: 0.9,
      to: { env: "amusement", spawn: "gaming-door" },
      prompt: "🚪 بیرون رفتن به خیابان",
      walkThrough: true,
    },
  ],
  areaAt: gamingCenterAreaAt,
  areaLabels: {
    "gc-hall": "🎮 گیم‌نت",
    "gc-train": "🎮 گیم‌نت · اتاق قطار",
    "gc-stairs": "🎮 راه‌پلهٔ گیم‌نت",
  },
  surfaceAt: (_x, y, _z, onStairs) => (onStairs || y > 0.05 ? "stairs" : "tile"),
  scene: () => import("./Scene"),
  // a separate download, fetched when the player nears the street door (or travels here)
  load: "on-demand",
  preloadDistance: 5,
  menuTravel: { label: "🎮 گیم‌نت (زیرزمین)" },
  assets: ["envs/gaming-center/*"],
  mapPlan: { viewBox: { x: ox - 6, y: oz - 16.4, w: 12, h: 24.2 }, shapes: mapShapes() },
};
