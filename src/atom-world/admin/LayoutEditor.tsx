"use client";

import { useRef, useState } from "react";
import type { WorldConfig } from "../world/config";
import { ITEM_KINDS, type ItemKindId, itemColliders } from "../world/items";
import { ItemShape } from "../world/ItemShapes";
import { ENVIRONMENTS, envById } from "../world/registry";
import styles from "./admin.module.css";
import { addableKinds, addItem, editableItems, type EditableItem, isAdded, patchItem, removeAdded, resetItem } from "./draft";

const SNAP = 0.05;
const snap = (v: number) => Math.round(v / SNAP) * SNAP;

/** Floors that can be edited: every environment level that has items or can take new ones. */
const FLOORS = floors();

function floors() {
  return ENVIRONMENTS.flatMap((e) =>
    e.levels
      .filter((l) => e.items.some((i) => i.level === l.id) || addableKinds(e.id, l.id).length > 0)
      .map((l) => ({ env: e.id, level: l.id, label: e.levels.length > 1 ? `${e.name} — ${l.label}` : e.name })),
  );
}

type View = { x: number; y: number; w: number; h: number };

function initialView(envId: string, level: string): View {
  const e = envById(envId)!;
  const v = e.levels.find((l) => l.id === level)?.view ?? e.bounds;
  return { x: v.xMin, y: v.zMin, w: v.xMax - v.xMin, h: v.zMax - v.zMin };
}

const structureCache = new Map<string, ReturnType<typeof buildStructure>>();

/** Fixed parts of the building on that floor (walls, counters, stairs), from the collision boxes. */
function structure(envId: string, level: string) {
  const key = `${envId}:${level}`;
  if (!structureCache.has(key)) structureCache.set(key, buildStructure(envId, level));
  return structureCache.get(key)!;
}

function buildStructure(envId: string, level: string) {
  const e = envById(envId)!;
  const y = e.levels.find((l) => l.id === level)?.y ?? 0;
  return e
    .colliders()
    .filter((b) => b.tag !== "slab" && !(b.tag === "wall" && b.camera === false) && b.max[1] > y + 0.1 && b.min[1] < y + 1.8)
    .map((b) => ({ x0: b.min[0], z0: b.min[2], x1: b.max[0], z1: b.max[2], tag: b.tag }));
}

const overlap = (a: { x0: number; x1: number; z0: number; z1: number }, b: { x0: number; x1: number; z0: number; z1: number }) =>
  a.x0 < b.x1 - 0.02 && b.x0 < a.x1 - 0.02 && a.z0 < b.z1 - 0.02 && b.z0 < a.z1 - 0.02;

export function itemName(i: EditableItem) {
  const k = ITEM_KINDS[i.kind];
  return i.kind === "gc-station" ? `${k.label} ${i.number !== undefined ? `شمارهٔ ${i.number.toLocaleString("fa-IR")}` : ""} (${i.console === "ps5" ? "PS5" : "PS4"})` : k.label;
}

export function LayoutEditor({ draft, onChange }: { draft: WorldConfig; onChange: (c: WorldConfig) => void }) {
  const list = FLOORS;
  const [floorIdx, setFloorIdx] = useState(0);
  const floor = list[floorIdx];
  const [view, setView] = useState<View>(() => initialView(floor.env, floor.level));
  const [selected, setSelected] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "item"; id: string; dx: number; dz: number } | { kind: "pan"; cx: number; cy: number; view: View } | null>(null);

  const items = editableItems(draft, floor.env, floor.level);
  const fixed = structure(floor.env, floor.level);
  const sel = items.find((i) => i.id === selected) ?? null;
  const env = envById(floor.env)!;

  const toPlan = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  };

  const chooseFloor = (i: number) => {
    setFloorIdx(i);
    setSelected(null);
    setView(initialView(list[i].env, list[i].level));
  };

  const zoom = (f: number) =>
    setView((v) => {
      const w = Math.min(60, Math.max(3, v.w * f));
      const h = (v.h * w) / v.w;
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h };
    });

  const onItemDown = (e: React.PointerEvent, it: EditableItem) => {
    e.stopPropagation();
    setSelected(it.id);
    const [px, pz] = toPlan(e);
    drag.current = { kind: "item", id: it.id, dx: it.x - px, dz: it.z - pz };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onDown = (e: React.PointerEvent) => {
    setSelected(null);
    drag.current = { kind: "pan", cx: e.clientX, cy: e.clientY, view };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (d.kind === "pan") {
      const r = svgRef.current!.getBoundingClientRect();
      const k = Math.max(d.view.w / r.width, d.view.h / r.height);
      setView({ ...d.view, x: d.view.x - (e.clientX - d.cx) * k, y: d.view.y - (e.clientY - d.cy) * k });
      return;
    }
    const [px, pz] = toPlan(e);
    const b = env.bounds;
    const x = Math.min(b.xMax, Math.max(b.xMin, snap(px + d.dx)));
    const z = Math.min(b.zMax, Math.max(b.zMin, snap(pz + d.dz)));
    onChange(patchItem(draft, d.id, { x, z }));
  };

  const onUp = () => {
    drag.current = null;
  };

  // what the selected item would bump into (a warning only: the manager decides)
  const clash = clashOf();
  function clashOf() {
    if (!sel || sel.hidden) return null;
    const y = env.levels.find((l) => l.id === floor.level)?.y ?? 0;
    const mine = itemColliders(sel, y).map((b) => ({ x0: b.min[0], x1: b.max[0], z0: b.min[2], z1: b.max[2] }));
    if (mine.length === 0) return null;
    if (fixed.some((f) => f.tag !== "stairs" && mine.some((m) => overlap(m, f)))) return "روی دیوار یا وسایل ثابت قرار گرفته است.";
    for (const o of items) {
      if (o.id === sel.id || o.hidden) continue;
      if (itemColliders(o, y).some((b) => mine.some((m) => overlap(m, { x0: b.min[0], x1: b.max[0], z0: b.min[2], z1: b.max[2] })))) return `با «${itemName(o)}» هم‌پوشانی دارد.`;
    }
    return null;
  }

  const add = (kind: ItemKindId) => {
    const r = addItem(draft, kind, floor.env, floor.level, view.x + view.w / 2, view.y + view.h / 2);
    onChange(r.cfg);
    setSelected(r.id);
  };

  const kinds = addableKinds(floor.env, floor.level);
  const turn = (deg: number) => sel && onChange(patchItem(draft, sel.id, { rotY: sel.rotY - (deg * Math.PI) / 180 }));

  return (
    <div className={styles.layoutWrap}>
      <div>
        <div className={styles.row} style={{ marginBottom: 8 }}>
          <label className={styles.srOnly} htmlFor="aw-floor">
            بخش
          </label>
          <select id="aw-floor" className={styles.input} style={{ flex: "1 1 200px" }} value={floorIdx} onChange={(e) => chooseFloor(Number(e.target.value))}>
            {list.map((f, i) => (
              <option key={`${f.env}:${f.level}`} value={i}>
                {f.label}
              </option>
            ))}
          </select>
          {kinds.length > 0 && (
            <select
              className={styles.input}
              style={{ flex: "1 1 200px" }}
              aria-label="افزودن وسیله"
              value=""
              onChange={(e) => e.target.value && add(e.target.value as ItemKindId)}
            >
              <option value="">➕ افزودن وسیله…</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {ITEM_KINDS[k].label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className={styles.planBox}>
          <svg
            ref={svgRef}
            className={styles.plan}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            preserveAspectRatio="xMidYMid meet"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            role="application"
            aria-label={`نقشهٔ ${floor.label}؛ وسیله‌ها را با کشیدن جابه‌جا کنید`}
          >
            <rect x={view.x - 100} y={view.y - 100} width={view.w + 200} height={view.h + 200} fill="#0d1012" />
            {fixed.map((f, i) => (
              <rect key={i} x={f.x0} y={f.z0} width={f.x1 - f.x0} height={f.z1 - f.z0} fill={f.tag === "wall" || f.tag === "glass" ? "#59616b" : f.tag === "stairs" ? "#3b4249" : "#2e353c"} />
            ))}
            {items.map((it) => (
              <g key={it.id} onPointerDown={(e) => onItemDown(e, it)} style={{ cursor: "move" }} data-item={it.id}>
                <ItemShape item={it} stroke={it.id === selected ? "#ff4fa3" : it.added ? "#39ff88" : undefined} strokeWidth={0.12} opacity={it.hidden ? 0.3 : 1} />
              </g>
            ))}
          </svg>
          <div className={styles.planTools}>
            <button type="button" className={styles.btn} aria-label="بزرگ‌نمایی" onClick={() => zoom(0.8)}>
              +
            </button>
            <button type="button" className={styles.btn} aria-label="کوچک‌نمایی" onClick={() => zoom(1.25)}>
              −
            </button>
            <button type="button" className={styles.btn} aria-label="نمای کامل" onClick={() => setView(initialView(floor.env, floor.level))}>
              ⤢
            </button>
          </div>
        </div>
        <p className={styles.status} style={{ marginTop: 6 }}>
          روی هر وسیله بزنید و بکشید تا جابه‌جا شود (هر ۵ سانتی‌متر). برای جابه‌جایی نقشه، جای خالی را بکشید. دیوارها و پیشخوان‌ها بخشی از ساختمان‌اند و ثابت می‌مانند.
        </p>
      </div>

      <aside className={`${styles.card} ${styles.inspector}`} aria-live="polite">
        {!sel ? (
          <p className={styles.status} style={{ margin: 0 }}>
            یک وسیله را روی نقشه انتخاب کنید یا از «افزودن وسیله» یک مورد تازه بگذارید.
          </p>
        ) : (
          <>
            <div className={styles.cardHead}>
              <h3 className={styles.cardTitle}>{itemName(sel)}</h3>
              {sel.added && <span className={styles.badge}>افزوده‌شده</span>}
              {sel.hidden && <span className={styles.badge}>پنهان</span>}
            </div>
            {clash && <p className={`${styles.note} ${styles.warnNote}`}>⚠️ {clash}</p>}
            <div className={styles.row} style={{ marginBottom: 10 }}>
              <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => turn(-15)}>
                ↺ ۱۵°
              </button>
              <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => turn(15)}>
                ↻ ۱۵°
              </button>
              <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => turn(-90)}>
                ↺ ۹۰°
              </button>
              <button type="button" className={`${styles.btn} ${styles.small}`} onClick={() => turn(90)}>
                ↻ ۹۰°
              </button>
            </div>
            <div className={styles.grid2}>
              {(["x", "z"] as const).map((k) => (
                <label key={k} className={styles.field}>
                  {k === "x" ? "چپ / راست (متر)" : "جلو / عقب (متر)"}
                  <input
                    className={styles.input}
                    type="number"
                    step={0.05}
                    inputMode="decimal"
                    value={Number(sel[k].toFixed(2))}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const b = env.bounds;
                      if (Number.isFinite(v)) onChange(patchItem(draft, sel.id, { x: k === "x" ? Math.min(b.xMax, Math.max(b.xMin, v)) : sel.x, z: k === "z" ? Math.min(b.zMax, Math.max(b.zMin, v)) : sel.z }));
                    }}
                  />
                </label>
              ))}
            </div>
            {sel.kind === "gc-station" && (
              <div className={styles.grid2}>
                <label className={styles.field}>
                  شمارهٔ سیستم
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    max={99}
                    value={sel.number ?? ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isInteger(n) && n >= 1 && n <= 99) onChange(patchItem(draft, sel.id, { number: n }));
                    }}
                  />
                </label>
                <label className={styles.field}>
                  کنسول
                  <select className={styles.input} value={sel.console ?? "ps4"} onChange={(e) => onChange(patchItem(draft, sel.id, { console: e.target.value as "ps4" | "ps5" }))}>
                    <option value="ps4">PS4</option>
                    <option value="ps5">PS5</option>
                  </select>
                </label>
              </div>
            )}
            <div className={styles.row}>
              {isAdded(draft, sel.id) ? (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.danger}`}
                  onClick={() => {
                    onChange(removeAdded(draft, sel.id));
                    setSelected(null);
                  }}
                >
                  🗑 حذف
                </button>
              ) : (
                <>
                  <button type="button" className={styles.btn} onClick={() => onChange(patchItem(draft, sel.id, { hidden: !sel.hidden }))}>
                    {sel.hidden ? "👁 نمایش دوباره" : "🚫 پنهان کردن"}
                  </button>
                  <button type="button" className={styles.btn} disabled={!draft.items[sel.id]} onClick={() => onChange(resetItem(draft, sel.id))}>
                    ↩ جای اصلی
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
