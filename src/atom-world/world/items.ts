/**
 * Placeable items: furniture and machines that the club's manager can move, turn, hide or add
 * from the admin editor (docs/ADMIN_WORLD.md). The building itself (walls, stairs, counters fixed
 * to the walls) stays in code; everything that stands on the floor and can be moved in the real
 * club is an item.
 *
 * Pure data (no React): used by the game (colliders, interactions, scenes, map), by the server
 * (validation of the saved config) and by the editor.
 */
import type { Box } from "../data/environment";

export type ItemKindId =
  | "air-hockey"
  | "baroque-sofa"
  | "baroque-armchair"
  | "round-table"
  | "folding-table"
  | "plant"
  | "events-board"
  | "footballs-table"
  | "gray-sofa"
  | "gc-station"
  | "gc-sofa"
  | "gc-armchair"
  | "face-paint";

export type Console = "ps4" | "ps5";

/** One placed item. `x` / `z` are world coordinates, `rotY` turns it about its centre. */
export interface WorldItem {
  id: string;
  kind: ItemKindId;
  env: string;
  /** Floor level inside the environment (`EnvironmentDef.levels`), e.g. "ground" / "upper". */
  level: string;
  x: number;
  z: number;
  rotY: number;
  /** Sofas: length in metres. */
  length?: number;
  /** Stations: number on the sign and the console. */
  number?: number;
  console?: Console;
  /** Added by the manager in the editor (not part of the built-in layout). */
  added?: boolean;
}

/** A box in the item's own space (built facing +z): x / z ranges and height. */
export interface LocalBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
}

export interface ItemKind {
  id: ItemKindId;
  /** Persian name in the editor. */
  label: string;
  /** Footprint (width along x, depth along z, facing +z) and height. */
  size: (item: WorldItem) => { w: number; d: number; h: number };
  /** Collision tag; null = walk-through (a hologram). */
  collider: Box["tag"] | null;
  /** Extra / different collision boxes in item space (default: the footprint). */
  boxes?: (item: WorldItem) => LocalBox[];
  /** Machine whose info panel / prompt the item opens. */
  machine?: (item: WorldItem) => string;
  /** Interaction point: metres ahead of the centre (facing direction), height, radius. */
  interact?: { ahead: number; y: number; radius: number };
  /** Height of the floating marker above the floor. */
  markerHeight?: number;
  /** Environments it may be placed in by the editor ("+" button), and its levels there. */
  addTo?: Record<string, string[]>;
  /** Colour on the editor / mini-map plan. */
  color: string;
  defaults?: Partial<WorldItem>;
}

const fixed = (w: number, d: number, h: number) => () => ({ w, d, h });

export const ITEM_KINDS: Record<ItemKindId, ItemKind> = {
  "air-hockey": {
    id: "air-hockey",
    label: "میز ایرهاکی",
    size: fixed(2.3, 1.25, 0.8),
    collider: "machine",
    machine: () => "air-hockey",
    interact: { ahead: 0, y: 0.9, radius: 2.1 },
    markerHeight: 2.2,
    addTo: { amusement: ["ground", "upper"] },
    color: "#2f80ff",
  },
  "baroque-sofa": {
    id: "baroque-sofa",
    label: "مبل سفید و طلایی",
    size: (i) => ({ w: i.length ?? 2.2, d: 0.9, h: 0.95 }),
    collider: "furniture",
    addTo: { amusement: ["ground", "upper"] },
    color: "#cfc8b8",
    defaults: { length: 2.2 },
  },
  "baroque-armchair": {
    id: "baroque-armchair",
    label: "مبل تک‌نفرهٔ سفید",
    size: fixed(0.85, 0.85, 0.95),
    collider: "furniture",
    addTo: { amusement: ["ground", "upper"] },
    color: "#cfc8b8",
  },
  "round-table": {
    id: "round-table",
    label: "میز گرد",
    size: fixed(0.8, 0.8, 0.45),
    collider: "furniture",
    addTo: { amusement: ["ground", "upper"] },
    color: "#6b5d52",
  },
  "folding-table": {
    id: "folding-table",
    label: "میز و صندلی تاشو",
    size: fixed(0.8, 0.8, 0.75),
    collider: "furniture",
    addTo: { amusement: ["ground", "upper"] },
    color: "#d8b98b",
  },
  plant: {
    id: "plant",
    label: "گلدان",
    size: fixed(0.6, 0.6, 1.2),
    collider: "furniture",
    addTo: { amusement: ["ground", "upper"], "gaming-center": ["main"] },
    color: "#3f7d3a",
  },
  "events-board": {
    id: "events-board",
    label: "تابلوی تورنومنت‌ها (مجازی)",
    size: fixed(1.5, 0.3, 2.1),
    collider: null,
    machine: () => "events-board",
    interact: { ahead: 0, y: 1.0, radius: 1.6 },
    markerHeight: 2.45,
    color: "#39ff88",
  },
  "footballs-table": {
    id: "footballs-table",
    label: "میز FOOTBALLS",
    size: fixed(0.95, 2.35, 0.82),
    collider: "machine",
    // the table (1.75 m long) and its red cage stool in front of it
    boxes: () => [
      { x0: -0.475, x1: 0.475, z0: -0.875, z1: 0.875, h: 0.82 },
      { x0: -0.475, x1: 0.475, z0: 0.925, z1: 1.475, h: 0.46 },
    ],
    machine: () => "footballs-table",
    interact: { ahead: 0, y: 0.9, radius: 1.7 },
    markerHeight: 1.75,
    addTo: { amusement: ["ground", "upper"] },
    color: "#2f80ff",
  },
  "gray-sofa": {
    id: "gray-sofa",
    label: "مبل طوسی دونفره",
    size: (i) => ({ w: i.length ?? 1.7, d: 0.85, h: 0.95 }),
    collider: "furniture",
    addTo: { amusement: ["ground", "upper"] },
    color: "#566273",
    defaults: { length: 1.7 },
  },
  "gc-station": {
    id: "gc-station",
    label: "سیستم (تلویزیون و کنسول)",
    size: fixed(1.2, 0.45, 1.25),
    collider: "furniture",
    machine: (i) => (i.console === "ps5" ? "gc-ps5" : "gc-ps4"),
    interact: { ahead: 1.0, y: 0.9, radius: 1.1 },
    markerHeight: 1.65,
    addTo: { "gaming-center": ["main"] },
    color: "#151515",
    defaults: { console: "ps4" },
  },
  "gc-sofa": {
    id: "gc-sofa",
    label: "مبل طوسی کاپیتونی",
    size: (i) => ({ w: i.length ?? 1.9, d: 0.88, h: 0.9 }),
    collider: "furniture",
    addTo: { "gaming-center": ["main"] },
    color: "#7c8792",
    defaults: { length: 1.9 },
  },
  "face-paint": {
    id: "face-paint",
    label: "میز گریم صورت",
    // the vanity (with its mirror) and the child's stool in front of it
    size: fixed(0.9, 0.45, 0.75),
    collider: "furniture",
    boxes: () => [
      { x0: -0.45, x1: 0.45, z0: -0.225, z1: 0.225, h: 0.75 },
      { x0: -0.18, x1: 0.18, z0: 0.42, z1: 0.78, h: 0.42 },
    ],
    machine: () => "face-paint",
    interact: { ahead: 0.75, y: 0.9, radius: 1.3 },
    markerHeight: 2.0,
    addTo: { amusement: ["ground", "upper"] },
    color: "#ff6fb5",
  },
  "gc-armchair": {
    id: "gc-armchair",
    label: "صندلی دسته‌فلزی",
    size: fixed(0.7, 0.7, 0.85),
    collider: "furniture",
    addTo: { "gaming-center": ["main"] },
    color: "#7c8792",
  },
};

/** Item-space point → world (x, z). */
export function toWorldXZ(item: Pick<WorldItem, "x" | "z" | "rotY">, lx: number, lz: number): [number, number] {
  const c = Math.cos(item.rotY);
  const s = Math.sin(item.rotY);
  return [item.x + lx * c + lz * s, item.z - lx * s + lz * c];
}

/** World-axis bounding box of a local box after turning the item (any angle). */
export function worldRect(item: WorldItem, b: LocalBox) {
  const pts = [
    toWorldXZ(item, b.x0, b.z0),
    toWorldXZ(item, b.x1, b.z0),
    toWorldXZ(item, b.x0, b.z1),
    toWorldXZ(item, b.x1, b.z1),
  ];
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { xMin: Math.min(...xs), xMax: Math.max(...xs), zMin: Math.min(...zs), zMax: Math.max(...zs) };
}

export function itemBoxes(item: WorldItem): LocalBox[] {
  const k = ITEM_KINDS[item.kind];
  if (k.boxes) return k.boxes(item);
  const { w, d, h } = k.size(item);
  return [{ x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2, h }];
}

/** Collision boxes of an item standing on a floor at height `y`. */
export function itemColliders(item: WorldItem, y: number): Box[] {
  const k = ITEM_KINDS[item.kind];
  if (!k.collider) return [];
  return itemBoxes(item).map((b) => {
    const r = worldRect(item, b);
    return { min: [r.xMin, y, r.zMin], max: [r.xMax, y + b.h, r.zMax], tag: k.collider!, camera: false };
  });
}

/** Interaction point of an item (null when it has no machine). */
export function itemInteractable(item: WorldItem, y: number) {
  const k = ITEM_KINDS[item.kind];
  if (!k.machine || !k.interact) return null;
  const [x, z] = toWorldXZ(item, 0, k.interact.ahead);
  return { id: item.id, machineId: k.machine(item), position: [x, y + k.interact.y, z] as [number, number, number], radius: k.interact.radius };
}

/** The manager's changes to the items: move / turn / hide built-in ones, plus added ones. */
export interface ItemChanges {
  items: Record<string, { x?: number; z?: number; rotY?: number; hidden?: boolean; number?: number; console?: Console }>;
  added: WorldItem[];
}

export const NO_CHANGES: ItemChanges = { items: {}, added: [] };

/** Built-in items with the manager's changes applied (hidden ones removed) and the added ones. */
export function resolveItems(defaults: WorldItem[], changes: ItemChanges = NO_CHANGES): WorldItem[] {
  const out: WorldItem[] = [];
  for (const d of defaults) {
    const c = changes.items[d.id];
    if (c?.hidden) continue;
    out.push({ ...d, ...(c ? pick(c) : {}) });
  }
  for (const a of changes.added) if (!defaults.some((d) => d.id === a.id)) out.push({ ...a, added: true });
  return out;
}

function pick(c: ItemChanges["items"][string]): Partial<WorldItem> {
  const o: Partial<WorldItem> = {};
  if (c.x !== undefined) o.x = c.x;
  if (c.z !== undefined) o.z = c.z;
  if (c.rotY !== undefined) o.rotY = c.rotY;
  if (c.number !== undefined) o.number = c.number;
  if (c.console !== undefined) o.console = c.console;
  return o;
}
