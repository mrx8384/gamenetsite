import type { WorldItem } from "../../world/items";
import { ARMCHAIRS, GC_ORIGIN, SOFAS, STATIONS, stationId } from "./layout";

/** Stations, sofas and armchairs of the gaming center at their places in the photos (./layout.ts). */
const base = { env: "gaming-center", level: "main" } as const;

export const GC_ITEMS: WorldItem[] = [
  ...STATIONS.map((s, i) => ({
    ...base,
    id: stationId(s, i),
    kind: "gc-station" as const,
    x: GC_ORIGIN.x + s.x,
    z: GC_ORIGIN.z + s.z,
    rotY: s.rotY,
    console: s.console,
    ...(s.number !== null ? { number: s.number } : {}),
  })),
  ...SOFAS.map((s) => ({ ...base, id: s.id, kind: "gc-sofa" as const, x: GC_ORIGIN.x + s.x, z: GC_ORIGIN.z + s.z, rotY: s.rotY, length: s.length })),
  ...ARMCHAIRS.map((s) => ({ ...base, id: s.id, kind: "gc-armchair" as const, x: GC_ORIGIN.x + s.x, z: GC_ORIGIN.z + s.z, rotY: s.rotY })),
];
