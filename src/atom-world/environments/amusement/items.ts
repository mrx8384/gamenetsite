import { AIR_HOCKEY_TABLES, EVENTS_BOARD, FOLDING_TABLE, LOUNGE, PLANTS, RIGHT_SOFA } from "../../data/environment";
import { FOOTBALLS_TABLES, GRAY_SOFA } from "../../data/upperFloor";
import type { WorldItem } from "../../world/items";

/**
 * Movable furniture and machines of the hall, at their places in the photos (data/environment.ts,
 * data/upperFloor.ts). The admin editor can move, turn, hide or add to these.
 */
const base = { env: "amusement" } as const;

export const AMUSEMENT_ITEMS: WorldItem[] = [
  ...AIR_HOCKEY_TABLES.map((t) => ({ ...base, id: t.id, kind: "air-hockey" as const, level: "ground", x: t.x, z: t.z, rotY: t.rotY ?? 0 })),
  { ...base, id: "lounge-sofa", kind: "baroque-sofa", level: "ground", x: LOUNGE.sofa.x, z: LOUNGE.sofa.z, rotY: Math.PI / 2, length: LOUNGE.sofa.length },
  { ...base, id: "lounge-armchair", kind: "baroque-armchair", level: "ground", x: LOUNGE.armchair.x, z: LOUNGE.armchair.z, rotY: Math.PI / 2 + 0.25 },
  { ...base, id: "lounge-table", kind: "round-table", level: "ground", x: LOUNGE.table.x, z: LOUNGE.table.z, rotY: 0 },
  { ...base, id: "right-sofa", kind: "baroque-sofa", level: "ground", x: RIGHT_SOFA.x, z: RIGHT_SOFA.z, rotY: -Math.PI / 2, length: RIGHT_SOFA.length },
  { ...base, id: "folding-table", kind: "folding-table", level: "ground", x: FOLDING_TABLE.x, z: FOLDING_TABLE.z, rotY: 0 },
  ...PLANTS.map((p, i) => ({ ...base, id: `plant-${i + 1}`, kind: "plant" as const, level: "ground", x: p.x, z: p.z, rotY: 0 })),
  { ...base, id: "events-board", kind: "events-board", level: "ground", x: EVENTS_BOARD.x, z: EVENTS_BOARD.z, rotY: EVENTS_BOARD.heading },
  ...FOOTBALLS_TABLES.map((t) => ({ ...base, id: t.id, kind: "footballs-table" as const, level: "upper", x: t.x, z: t.z, rotY: 0 })),
  { ...base, id: "gray-sofa", kind: "gray-sofa", level: "upper", x: GRAY_SOFA.x, z: GRAY_SOFA.z, rotY: -Math.PI / 2, length: GRAY_SOFA.length },
];
