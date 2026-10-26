/**
 * Editing helpers of the world editor: pure functions from one draft config to the next.
 */
import type { WorldConfig } from "../world/config";
import { ITEM_KINDS, type ItemKindId, type WorldItem } from "../world/items";
import { ENVIRONMENTS, envById } from "../world/registry";

export type EditableItem = WorldItem & { hidden?: boolean };

/** Items of one floor as the draft has them, hidden built-in ones included (so they can come back). */
export function editableItems(cfg: WorldConfig, envId: string, level: string): EditableItem[] {
  const env = envById(envId);
  if (!env) return [];
  const out: EditableItem[] = [];
  for (const d of env.items) {
    if (d.level !== level) continue;
    const c = cfg.items[d.id] ?? {};
    out.push({ ...d, ...(c.x !== undefined ? { x: c.x, z: c.z! } : {}), ...(c.rotY !== undefined ? { rotY: c.rotY } : {}), ...(c.number !== undefined ? { number: c.number } : {}), ...(c.console ? { console: c.console } : {}), hidden: c.hidden });
  }
  for (const a of cfg.added) if (a.env === envId && a.level === level) out.push(a);
  return out;
}

export function isAdded(cfg: WorldConfig, id: string) {
  return cfg.added.some((a) => a.id === id);
}

export type ItemPatch = Partial<Pick<EditableItem, "x" | "z" | "rotY" | "hidden" | "number" | "console">>;

const round = (v: number) => Math.round(v * 100) / 100;
const norm = (a: number) => Math.round(Math.atan2(Math.sin(a), Math.cos(a)) * 1000) / 1000;

export function patchItem(cfg: WorldConfig, id: string, p: ItemPatch): WorldConfig {
  const q: ItemPatch = { ...p };
  if (q.x !== undefined) q.x = round(q.x);
  if (q.z !== undefined) q.z = round(q.z);
  if (q.rotY !== undefined) q.rotY = norm(q.rotY);
  if (isAdded(cfg, id)) {
    const rest = { ...q };
    delete rest.hidden; // added items are deleted, not hidden
    return { ...cfg, added: cfg.added.map((a) => (a.id === id ? { ...a, ...rest } : a)) };
  }
  const prev = cfg.items[id] ?? {};
  const next = { ...prev, ...q };
  if (next.hidden === false) delete next.hidden;
  return { ...cfg, items: { ...cfg.items, [id]: next } };
}

/** Built-in item back to its place in the photos. */
export function resetItem(cfg: WorldConfig, id: string): WorldConfig {
  const items = { ...cfg.items };
  delete items[id];
  return { ...cfg, items };
}

export function removeAdded(cfg: WorldConfig, id: string): WorldConfig {
  return { ...cfg, added: cfg.added.filter((a) => a.id !== id) };
}

/** Smallest station number not used by any (visible) station — e.g. 7 in the gaming center. */
export function nextStationNumber(cfg: WorldConfig) {
  const used = new Set<number>();
  for (const e of ENVIRONMENTS)
    for (const l of e.levels)
      for (const i of editableItems(cfg, e.id, l.id)) if (i.kind === "gc-station" && !i.hidden && i.number !== undefined) used.add(i.number);
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

export function addItem(cfg: WorldConfig, kind: ItemKindId, envId: string, level: string, x: number, z: number, rand = Math.random): { cfg: WorldConfig; id: string } {
  const env = envById(envId)!;
  const b = env.bounds;
  const id = `add-${kind}-${Math.floor(rand() * 36 ** 4)
    .toString(36)
    .padStart(4, "0")}`;
  const k = ITEM_KINDS[kind];
  const item: WorldItem = {
    id,
    kind,
    env: envId,
    level,
    x: round(Math.min(b.xMax, Math.max(b.xMin, x))),
    z: round(Math.min(b.zMax, Math.max(b.zMin, z))),
    rotY: 0,
    added: true,
    ...(k.defaults?.length !== undefined ? { length: k.defaults.length } : {}),
    ...(kind === "gc-station" ? { console: "ps4" as const, number: nextStationNumber(cfg) } : {}),
  };
  return { cfg: { ...cfg, added: [...cfg.added, item] }, id };
}

/** Kinds the editor offers on a floor ("+" menu). */
export function addableKinds(envId: string, level: string): ItemKindId[] {
  return (Object.keys(ITEM_KINDS) as ItemKindId[]).filter((k) => ITEM_KINDS[k].addTo?.[envId]?.includes(level));
}
