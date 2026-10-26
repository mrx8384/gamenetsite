"use client";

import { areaLabel, worldInteractables } from "../world/registry";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "./useDialogFocus";
import { PIT, PIT_COUNTERS, ZONE_EXIT, ZONE_ORIGIN, ZONE_ROOM } from "../data/constructionZone";
import {
  COUNTER,
  ENTRANCE_DOOR,
  FRIDGE,
  HALL,
  KIDS_CARPET,
  MEZZANINE,
  MURALS,
  SHELF,
  STAIRS,
} from "../data/environment";
import { FACADE_Z, SIDEWALK, STEP, STEPS } from "../data/exterior";
import { FOOT_POOL, WOOD_PILLAR } from "../data/upperFloor";
import { ItemShapes } from "../world/ItemShapes";
import { type Area, areaAt } from "../data/world";
import { playerPose, useWorld, worldStore } from "../store";
import styles from "../styles/atomWorld.module.css";
import { envOfArea } from "../world/registry";
import type { MapPlan } from "../world/types";

const PAD = 0.6;
const hw = HALL.halfWidth;
const hl = HALL.halfLength;
const HALL_VB = { x: -hw - PAD - 1, y: -hl - PAD, w: HALL.width + PAD * 2 + 2, h: SIDEWALK.zMax + hl + PAD };
const UPPER_VB = { x: -hw - PAD, y: MEZZANINE.zBack - PAD, w: HALL.width + PAD * 2, h: MEZZANINE.zFront - MEZZANINE.zBack + 4.6 };
const ZONE_VB = {
  x: ZONE_ORIGIN.x + ZONE_ROOM.xMin - PAD,
  y: ZONE_ORIGIN.z + ZONE_ROOM.zMin - PAD,
  w: ZONE_ROOM.xMax - ZONE_ROOM.xMin + PAD * 2,
  h: ZONE_ROOM.zMax - ZONE_ROOM.zMin + PAD * 2,
};

/** Small always-on map (tap to enlarge). Generated from the layout data — a TEMPORARY plan. */
export function MiniMap() {
  const mapOpen = useWorld((s) => s.mapOpen);
  const area = useWorld((s) => s.area);
  return (
    <>
      <button type="button" className={styles.minimap} onClick={() => worldStore.set({ mapOpen: true })}>
        <div className={styles.mapLabel}>
          <span>{areaLabel(area)}</span>
          <span className={styles.mapTemp}>طرح موقت</span>
          <span className={styles.srOnly}>باز کردن نقشهٔ بزرگ</span>
        </div>
        <FloorPlan area={area} window={area === "ground" || area === "street" ? 12 : undefined} />
      </button>
      {mapOpen && <BigMap area={area} />}
    </>
  );
}

function BigMap({ area: playerArea }: { area: Area }) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef);
  const focus = useWorld((s) => s.mapFocus);
  const focusSpot = focus ? worldInteractables().find((i) => i.id === focus) : undefined;
  // «نمایش روی نقشه»: show the floor the machine is on
  const area = focusSpot ? areaAt(focusSpot.position[0], focusSpot.position[1] - 0.9, focusSpot.position[2]) : playerArea;
  const close = () => worldStore.set({ mapOpen: false, mapFocus: null });
  return (
    <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section ref={dialogRef} tabIndex={-1} className={`${styles.panel} ${styles.bigMap}`} role="dialog" aria-modal="true" aria-labelledby="aw-map-title" style={{ maxWidth: 440 }}>
        <div className={styles.panelHead}>
          <div>
            <h2 id="aw-map-title" className={styles.panelTitle}>
              نقشهٔ مجموعه — {areaLabel(area)}
            </h2>
            <div className={styles.panelSub}>
              <span className={styles.tempBadge}>طرح موقت</span>{" "}
              {area === "zone"
                ? "این بخش جدا نمایش داده می‌شود؛ محل آن در ساختمان هنوز تأیید نشده است."
                : "ابعاد و جانمایی از روی عکس‌ها تخمین زده شده؛ نقشهٔ دقیق ساختمان هنوز دریافت نشده است."}
            </div>
          </div>
          <button type="button" className={`${styles.btn} ${styles.iconBtn}`} aria-label="بستن" onClick={close} autoFocus>
            ✕
          </button>
        </div>
        <FloorPlan area={area} labels focusId={focus ?? undefined} />
        <div className={styles.legend}>
          <span style={{ "--c": "#39ff88" } as React.CSSProperties}>شما</span>
          <span style={{ "--c": "#2f80ff" } as React.CSSProperties}>دستگاه قابل تعامل</span>
          {area !== "zone" && <span style={{ "--c": "#8b8f94" } as React.CSSProperties}>راه‌پله</span>}
          {area === "ground" && <span style={{ "--c": "#ffdf00" } as React.CSSProperties}>نقاشی دیواری</span>}
        </div>
      </section>
    </div>
  );
}

function usePose() {
  const [pose, setPose] = useState({ x: playerPose.x, z: playerPose.z, heading: playerPose.heading });
  const raf = useRef(0);
  useEffect(() => {
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 100) {
        last = t;
        setPose({ x: playerPose.x, z: playerPose.z, heading: playerPose.heading });
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);
  return pose;
}

const rect = (x0: number, z0: number, x1: number, z1: number) => ({ x: x0, y: z0, width: x1 - x0, height: z1 - z0 });

const KNOWN_PLANS = ["ground", "upper", "zone"];

function FloorPlan({ area, labels = false, window: win, focusId }: { area: Area; labels?: boolean; window?: number; focusId?: string }) {
  const pose = usePose();
  const nearbyId = useWorld((s) => s.nearby?.id);
  const deg = ((Math.PI - pose.heading) * 180) / Math.PI;
  const focusMachine = focusId ? worldInteractables().find((i) => i.id === focusId)?.machineId : undefined;
  const hot = (id: string) => {
    if (focusMachine && worldInteractables().some((i) => i.id === id && i.machineId === focusMachine)) return "#ffdf00";
    return nearbyId === id ? "#39ff88" : "none";
  };
  const focusSpot = focusId ? worldInteractables().find((i) => i.id === focusId) : undefined;

  const plan = area === "street" ? "ground" : area;
  // other environments bring their own plan as data (EnvironmentDef.mapPlan); without one, say so
  const envPlan = KNOWN_PLANS.includes(plan) ? undefined : envOfArea(area)?.mapPlan;
  if (!KNOWN_PLANS.includes(plan) && !envPlan) return <p className={styles.noPlan}>نقشهٔ این بخش هنوز ثبت نشده است.</p>;
  let vb = envPlan ? envPlan.viewBox : plan === "zone" ? ZONE_VB : plan === "upper" ? UPPER_VB : HALL_VB;
  if (win && plan === "ground") {
    const top = Math.min(Math.max(pose.z - win / 2, -hl - PAD), SIDEWALK.zMax - win);
    vb = { ...HALL_VB, y: top, h: win };
  }

  return (
    <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={`نقشهٔ ${areaLabel(area)} و موقعیت شما`}>
      {plan === "ground" && <GroundPlan labels={labels} hot={hot} />}
      {plan === "upper" && <UpperPlan labels={labels} hot={hot} />}
      {plan === "zone" && <ZonePlan labels={labels} hot={hot} />}
      {envPlan && <DataPlan plan={envPlan} labels={labels} hot={hot} />}
      {envPlan && <ItemShapes envId={envOfArea(area)!.id} level={envOfArea(area)!.levels[0].id} hot={hot} />}
      {focusSpot && (
        <circle
          className={styles.pulse}
          cx={focusSpot.id === "foot-pool" ? (FOOT_POOL.xMin + FOOT_POOL.xMax) / 2 : focusSpot.position[0]}
          cy={focusSpot.id === "foot-pool" ? (FOOT_POOL.zMin + FOOT_POOL.zMax) / 2 : focusSpot.position[2]}
          r={1.3}
          fill="none"
          stroke="#ffdf00"
          strokeWidth={0.22}
        />
      )}
      <g transform={`translate(${pose.x} ${pose.z}) rotate(${deg})`}>
        <circle r={0.55} fill="#39ff88" opacity={0.25} />
        <path d="M0 -0.6 L0.42 0.4 L0 0.18 L-0.42 0.4 Z" fill="#39ff88" stroke="#06210f" strokeWidth={0.06} />
      </g>
    </svg>
  );
}

type PlanProps = { labels: boolean; hot: (id: string) => string };
const LABEL_PROPS = { fontSize: 0.55, fill: "#111", textAnchor: "middle", fontFamily: "inherit", style: { direction: "rtl" } } as const;

function Stairs() {
  return (
    <>
      <rect {...rect(STAIRS.xMin, STAIRS.zStart - STAIRS.steps * STAIRS.run, STAIRS.xMax, STAIRS.zStart)} fill="#8b8f94" />
      {Array.from({ length: STAIRS.steps }, (_, i) => (
        <line key={i} x1={STAIRS.xMin} x2={STAIRS.xMax} y1={STAIRS.zStart - i * STAIRS.run} y2={STAIRS.zStart - i * STAIRS.run} stroke="#5d6166" strokeWidth={0.04} />
      ))}
    </>
  );
}

function GroundPlan({ labels, hot }: PlanProps) {
  return (
    <>
      {/* sidewalk + entrance steps */}
      <rect {...rect(-hw - 1, FACADE_Z, hw + 1, SIDEWALK.zMax)} fill="#8d9096" />
      <rect {...rect(STEPS.xMin, FACADE_Z, STEPS.xMax, FACADE_Z + STEP.run * (STEP.count - 1))} fill="#d8d2c4" />
      <rect x={-hw} y={-hl} width={HALL.width} height={HALL.length} fill="#e9e9e6" stroke="#f6f7f5" strokeWidth={0.25} rx={0.2} />
      <rect {...rect(-hw, MEZZANINE.zBack, hw, MEZZANINE.zFront)} fill="#5b5f66" opacity={0.35} />
      {MURALS.map((m) => (
        <rect key={m.id} x={-hw - 0.05} y={m.z - m.width / 2} width={0.32} height={m.width} fill="#ffdf00" />
      ))}
      <rect {...rect(ENTRANCE_DOOR.xMin, hl - 0.15, ENTRANCE_DOOR.xMax, hl + 0.25)} fill="#39ff88" />
      <Stairs />
      <rect {...rect(COUNTER.xMin, COUNTER.zMin, COUNTER.xMax, COUNTER.zMax)} fill="#0f8f4a" stroke={hot("shop-counter")} strokeWidth={0.2} />
      <rect {...rect(SHELF.xMin, SHELF.zMin, SHELF.xMax, SHELF.zMax)} fill="#9a9a9a" />
      <rect {...rect(FRIDGE.xMin, FRIDGE.zMin, FRIDGE.xMax, FRIDGE.zMax)} fill="#bdbdbd" />
      <rect {...rect(KIDS_CARPET.xMin, KIDS_CARPET.zMin, KIDS_CARPET.xMax, KIDS_CARPET.zMax)} fill="#3f7fcf" opacity={0.6} />
      <ItemShapes envId="amusement" level="ground" hot={hot} />
      {labels && (
        <g {...LABEL_PROPS}>
          <text x={-1.5} y={FACADE_Z + 2}>پیاده‌رو</text>
          <text x={(STEPS.xMin + STEPS.xMax) / 2} y={hl - 0.5}>ورودی</text>
          <text x={0} y={(MEZZANINE.zBack + MEZZANINE.zFront) / 2} fill="#fff">
            زیر طبقهٔ دوم
          </text>
          <text x={STAIRS.xMin - 0.9} y={STAIRS.zStart - 2}>راه‌پله</text>
          <text x={(COUNTER.xMin + COUNTER.xMax) / 2 - 1.2} y={(COUNTER.zMin + COUNTER.zMax) / 2}>پیشخوان</text>
        </g>
      )}
    </>
  );
}

function UpperPlan({ labels, hot }: PlanProps) {
  const f = FOOT_POOL;
  return (
    <>
      <rect {...rect(-hw, MEZZANINE.zBack, hw, MEZZANINE.zFront)} fill="#e9e9e6" stroke="#f6f7f5" strokeWidth={0.25} />
      <line x1={-hw} x2={STAIRS.xMin} y1={MEZZANINE.zFront} y2={MEZZANINE.zFront} stroke="#ffffff" strokeWidth={0.18} strokeDasharray="0.3 0.15" />
      <Stairs />
      <rect {...rect(f.xMin, f.zMin, f.xMax, f.zMax)} fill="#1b2541" stroke={hot("foot-pool")} strokeWidth={0.2} />
      <rect {...rect(f.xMin + f.border, f.zMin + f.border, f.xMax - f.border, f.zMax - f.border)} fill="#2f80ff" opacity={0.7} />
      <rect {...rect(WOOD_PILLAR.xMin, WOOD_PILLAR.zMin, WOOD_PILLAR.xMax, WOOD_PILLAR.zMax)} fill="#b98b56" />
      <ItemShapes envId="amusement" level="upper" hot={hot} />
      {labels && (
        <g {...LABEL_PROPS}>
          <text x={(f.xMin + f.xMax) / 2} y={f.zMax + 0.8}>فوت‌پول</text>
          <text x={STAIRS.xMin - 0.9} y={STAIRS.zStart - 2.2} fill="#cfd3cf">
            راه‌پله
          </text>
          <text x={0} y={MEZZANINE.zFront + 0.8} fontSize={0.45} fill="#cfd3cf">
            لبهٔ نیم‌طبقه (تور)
          </text>
        </g>
      )}
    </>
  );
}

/** A plan described as data by its environment module. */
function DataPlan({ plan, labels, hot }: PlanProps & { plan: MapPlan }) {
  return (
    <>
      {plan.shapes.map((sh, i) =>
        sh.kind === "rect" ? (
          <rect key={i} {...rect(sh.x0, sh.z0, sh.x1, sh.z1)} fill={sh.fill} opacity={sh.opacity} rx={sh.rx} stroke={sh.hot ? hot(sh.hot) : undefined} strokeWidth={sh.hot ? 0.18 : undefined} />
        ) : labels || /^[\d۰-۹]+$/.test(sh.text) ? (
          <text key={i} {...LABEL_PROPS} x={sh.x} y={sh.z} fontSize={sh.size ?? LABEL_PROPS.fontSize} fill={sh.fill ?? LABEL_PROPS.fill}>
            {sh.text}
          </text>
        ) : null,
      )}
    </>
  );
}

function ZonePlan({ labels, hot }: PlanProps) {
  const o = ZONE_ORIGIN;
  const R = ZONE_ROOM;
  return (
    <>
      <rect {...rect(o.x + R.xMin, o.z + R.zMin, o.x + R.xMax, o.z + R.zMax)} fill="#e9e9e6" stroke="#f6f7f5" strokeWidth={0.2} />
      <rect {...rect(o.x + PIT.xMin, o.z + PIT.zMin, o.x + PIT.xMax, o.z + PIT.zMax)} fill="#b8ad98" stroke={hot("construction-zone")} strokeWidth={0.15} />
      <circle cx={o.x} cy={o.z - 0.85} r={0.42} fill="#5a4636" />
      {PIT_COUNTERS.map((c) => (
        <rect key={`${c.xMin}${c.zMin}`} {...rect(o.x + c.xMin, o.z + c.zMin, o.x + c.xMax, o.z + c.zMax)} fill="#ffffff" stroke="#bbb" strokeWidth={0.03} />
      ))}
      <rect {...rect(o.x + ZONE_EXIT.x - 0.5, o.z + R.zMax - 0.15, o.x + ZONE_EXIT.x + 0.5, o.z + R.zMax + 0.2)} fill="#39ff88" stroke={hot("zone-exit")} strokeWidth={0.1} />
      {labels && (
        <g {...LABEL_PROPS} fontSize={0.32}>
          <text x={o.x - 0.3} y={o.z - 1.6}>محوطهٔ خاکی</text>
          <text x={o.x + ZONE_EXIT.x} y={o.z + R.zMax - 0.35}>خروج</text>
        </g>
      )}
    </>
  );
}
