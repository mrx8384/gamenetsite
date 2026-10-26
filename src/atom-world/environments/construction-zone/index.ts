import { box, type Box } from "../../data/environment";
import { COUNTER_TOP, PIT, PIT_COUNTERS, ZONE_EXIT, ZONE_INTERACTABLES, ZONE_ORIGIN, ZONE_ROOM, ZONE_SPAWN, ZONE_WOOD_WALL } from "../../data/constructionZone";
import type { EnvironmentDef } from "../../world/types";

/**
 * 🚜 The RC construction-machines club, after construction-zone/construction-zone.jpg. Its place in
 * the building is not confirmed, so it is a separate environment reached from the menu / list; when
 * the real doorway is known, replace the "menu" portal with a "door" or "corridor" one.
 */
export function buildConstructionZoneColliders(): Box[] {
  const ox = ZONE_ORIGIN.x;
  const oz = ZONE_ORIGIN.z;
  const r = ZONE_ROOM;
  const t = 0.3;
  const out: Box[] = [
    box([ox + r.xMin - t, 0, oz + r.zMin - t], [ox + r.xMin, r.height, oz + r.zMax + t], "wall"),
    box([ox + r.xMax, 0, oz + r.zMin - t], [ox + r.xMax + t, r.height, oz + r.zMax + t], "wall"),
    box([ox + r.xMin, 0, oz + r.zMin - t], [ox + r.xMax, r.height, oz + r.zMin], "wall"),
    box([ox + r.xMin, 0, oz + r.zMax], [ox + r.xMax, r.height, oz + r.zMax + t], "wall"),
    box([ox + r.xMin, r.height, oz + r.zMin], [ox + r.xMax, r.height + t, oz + r.zMax], "slab"),
    // the pit itself is not walkable (toy-scale sand bed behind the counters)
    box([ox + PIT.xMin, 0, oz + PIT.zMin], [ox + PIT.xMax, COUNTER_TOP, oz + PIT.zMax], "furniture", false),
    box([ox + ZONE_WOOD_WALL.x, 0, oz + ZONE_WOOD_WALL.zMin], [ox + ZONE_WOOD_WALL.x + 0.08, ZONE_WOOD_WALL.height, oz + ZONE_WOOD_WALL.zMax], "wall"),
  ];
  for (const c of PIT_COUNTERS) out.push(box([ox + c.xMin, 0, oz + c.zMin], [ox + c.xMax, COUNTER_TOP, oz + c.zMax], "furniture", false));
  return out;
}

export const constructionZone: EnvironmentDef = {
  id: "construction-zone",
  name: "دنیای ماشین‌آلات راه‌سازی",
  bounds: { xMin: ZONE_ORIGIN.x - 10, xMax: ZONE_ORIGIN.x + 10, zMin: ZONE_ORIGIN.z - 10, zMax: ZONE_ORIGIN.z + 10 },
  colliders: buildConstructionZoneColliders,
  interactables: ZONE_INTERACTABLES,
  levels: [{ id: "main", y: 0, label: "ماشین‌آلات راه‌سازی" }],
  items: [],
  spawns: { default: { x: ZONE_ORIGIN.x + ZONE_SPAWN.x, y: 0, z: ZONE_ORIGIN.z + ZONE_SPAWN.z, heading: ZONE_SPAWN.heading } },
  portals: [
    // no confirmed doorway yet: the exit marker in the room takes you back next to the hall's counter
    { id: "zone-exit", kind: "menu", at: [ZONE_ORIGIN.x + ZONE_EXIT.x, 1.0, ZONE_ORIGIN.z + ZONE_EXIT.z], radius: 1.4, to: { env: "amusement", spawn: "counter" }, prompt: "🚪 بازگشت به سالن اصلی" },
  ],
  areaAt: () => "zone",
  areaLabels: { zone: "🚜 ماشین‌آلات راه‌سازی" },
  scene: () => import("./Scene"),
  load: "after-initial",
  menuTravel: { label: "🚜 دنیای ماشین‌آلات راه‌سازی" },
  assets: ["textures/mural-excavator.webp", "textures/sm/mural-excavator.webp"],
};
