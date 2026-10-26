/**
 * RC-excavator digging game (side view, no rendering).
 * The excavator moves on its tracks, swings its cab left / right, and works boom, stick (arm) and
 * bucket like a real machine. Soil is a height field: the bucket carves it, carries a load and pours
 * it where its mouth faces down. Soil poured into the truck bed scores points.
 * Units are toy-scale "metres" of the scene; the club's RC machines are about 1:14.
 */
export const SCENE = { width: 14, col: 0.1, bedrock: -0.9 } as const;
export const ARM = { pivotX: 0.35, pivotY: 1.35, boom: 2.6, stick: 1.9, bucket: 0.72 } as const;
export const LIMITS = {
  boom: [-0.4, 1.2],
  stick: [-2.65, -0.45],
  bucket: [-2.6, 1.15],
  baseX: [4.3, 7.7],
} as const;
const SPEED = { drive: 1.3, boom: 0.75, stick: 0.95, bucket: 1.7, swing: 1 / 0.9, autoLift: 1.1 };
/** Clearance the bucket needs over the ground / truck before the cab may turn. */
const SWING_CLEAR = 0.08;
export const BUCKET_CAP = 0.34; // soil area a full bucket holds
export const TRUCK = { x0: 0.75, x1: 3.5, bed: 1.0, wall: 1.6, cap: 1.25 } as const;
export const GAME_TIME = 120;
export const POINTS = { perArea: 100, fullTruck: 50 } as const;

export interface Controls {
  /** -1..1 each (joysticks / keys). */
  drive: number;
  boom: number;
  stick: number;
  bucket: number;
}

export interface Grain {
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
}

export type DigEvent =
  | { type: "dig" }
  | { type: "pour" }
  | { type: "deliver"; amount: number }
  | { type: "truckFull" }
  | { type: "blocked" }
  | { type: "swingStart" }
  | { type: "swingBlocked" };

export interface ExcavatorState {
  baseX: number;
  /** +1 = cab faces right (towards the soil pile), -1 = faces the truck. */
  facing: 1 | -1;
  /** Swing animation 0..1 (1 = settled). */
  swingT: number;
  /** Swing asked for: the boom lifts by itself until the bucket clears the ground, then the cab turns. */
  swingPending: boolean;
  boom: number;
  stick: number;
  bucket: number;
  load: number;
  heights: Float32Array;
  grains: Grain[];
  truckLoad: number;
  /** Truck leaving / arriving: seconds left (0 = parked). */
  truckAway: number;
  trucksFilled: number;
  delivered: number;
  score: number;
  timeLeft: number;
  over: boolean;
  pourAcc: number;
}

export function createExcavator(): ExcavatorState {
  const n = Math.round(SCENE.width / SCENE.col);
  const heights = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * SCENE.col;
    // flat dirt floor with a big soil pile on the right (like the club's sand area)
    const pile = Math.max(0, 1.35 - Math.abs(x - 10.6) * 0.55);
    heights[i] = Math.min(1.35, pile) + (x > 8 ? 0.05 : 0);
  }
  return {
    baseX: 6.3,
    facing: 1,
    swingT: 1,
    swingPending: false,
    boom: 0.55,
    stick: -1.55,
    bucket: -1.9,
    load: 0,
    heights,
    grains: [],
    truckLoad: 0,
    truckAway: 0,
    trucksFilled: 0,
    delivered: 0,
    score: 0,
    timeLeft: GAME_TIME,
    over: false,
    pourAcc: 0,
  };
}

const clamp = (v: number, [a, b]: readonly [number, number]) => (v < a ? a : v > b ? b : v);

export function surfaceAt(s: ExcavatorState, x: number) {
  const i = Math.floor(x / SCENE.col);
  if (i < 0 || i >= s.heights.length) return 0;
  return s.heights[i];
}

/** Joint positions in scene space for a pose (`facing` may be fractional while the cab swings). */
export function armPose(s: { baseX: number; facing: number; boom: number; stick: number; bucket: number }) {
  const f = s.facing;
  const px = s.baseX + f * ARM.pivotX;
  const py = ARM.pivotY;
  const a1 = s.boom;
  const a2 = a1 + s.stick;
  const a3 = a2 + s.bucket;
  const ex = px + f * Math.cos(a1) * ARM.boom;
  const ey = py + Math.sin(a1) * ARM.boom;
  const wx = ex + f * Math.cos(a2) * ARM.stick;
  const wy = ey + Math.sin(a2) * ARM.stick;
  const dx = Math.cos(a3);
  const dy = Math.sin(a3);
  const tx = wx + f * dx * ARM.bucket;
  const ty = wy + dy * ARM.bucket;
  // the bucket mouth faces the cab when the bucket points down: mouth = d rotated clockwise (local frame)
  const mouthY = -dx;
  return { pivot: { x: px, y: py }, elbow: { x: ex, y: ey }, wrist: { x: wx, y: wy }, tip: { x: tx, y: ty }, bucketAngle: a3, mouthY };
}

function inTruckBody(s: ExcavatorState, x: number, y: number) {
  return s.truckAway === 0 && x > TRUCK.x0 && x < TRUCK.x1 && y < TRUCK.bed;
}

/** One simulation step. */
export function stepExcavator(s: ExcavatorState, c: Controls, dtIn: number): DigEvent[] {
  const ev: DigEvent[] = [];
  if (s.over) return ev;
  const dt = Math.min(dtIn, 0.05);
  s.timeLeft = Math.max(0, s.timeLeft - dt);

  // swing animation (arm locked while turning)
  if (s.swingT < 1) s.swingT = Math.min(1, s.swingT + dt * SPEED.swing);
  if (s.swingPending) {
    if (swingClear(s)) {
      s.facing = s.facing === 1 ? -1 : 1;
      s.swingT = 0;
      s.swingPending = false;
      ev.push({ type: "swingStart" });
    } else if (s.boom >= LIMITS.boom[1] - 1e-6) {
      s.swingPending = false;
      ev.push({ type: "swingBlocked" });
    } else {
      // lift the boom first (the operator's hands are off the joysticks meanwhile)
      s.boom = clamp(s.boom + SPEED.autoLift * dt, LIMITS.boom);
    }
  }

  // tracks: the machine cannot drive while the bucket is in the ground
  const prev = { baseX: s.baseX, boom: s.boom, stick: s.stick, bucket: s.bucket };
  const prevPose = armPose(s);
  const prevDepth = surfaceAt(s, prevPose.tip.x) - prevPose.tip.y;
  if (s.swingT >= 1 && !s.swingPending) {
    s.baseX = clamp(s.baseX + c.drive * SPEED.drive * dt, LIMITS.baseX);
    s.boom = clamp(s.boom + c.boom * SPEED.boom * dt, LIMITS.boom);
    s.stick = clamp(s.stick + c.stick * SPEED.stick * dt, LIMITS.stick);
    s.bucket = clamp(s.bucket + c.bucket * SPEED.bucket * dt, LIMITS.bucket);
  }
  let pose = armPose(s);
  const tip = pose.tip;
  const floor = surfaceAt(s, tip.x);
  // hard limits: bedrock, the truck body, the scene edges
  let blocked = tip.y < SCENE.bedrock || inTruckBody(s, tip.x, tip.y) || tip.x < 0.05 || tip.x > SCENE.width - 0.05;
  // digging: carve soil above the tip into the bucket while it has room and its mouth is not pouring
  if (!blocked && tip.y < floor) {
    const moved = prev.baseX !== s.baseX;
    if (moved) blocked = true;
    else if (pose.mouthY > -0.45 && s.load < BUCKET_CAP) {
      const took = carve(s, tip.x, tip.y, BUCKET_CAP - s.load);
      if (took > 0) {
        s.load += took;
        ev.push({ type: "dig" });
      }
      if (pushedDeeper(surfaceAt(s, tip.x) - tip.y, prevDepth)) blocked = true;
    } else if (pushedDeeper(floor - tip.y, prevDepth)) blocked = true;
  }
  if (blocked) {
    Object.assign(s, prev);
    pose = armPose(s);
    ev.push({ type: "blocked" });
  }

  // pouring: rate grows with how far the mouth faces down
  if (s.load > 0 && pose.mouthY < -0.3) {
    const rate = (Math.min(1, (-pose.mouthY - 0.3) / 0.5) * BUCKET_CAP) / 0.9;
    const amount = Math.min(s.load, rate * dt);
    s.load -= amount;
    s.pourAcc += amount;
    // emit grains in small portions
    while (s.pourAcc > 0.004) {
      const a = 0.004;
      s.pourAcc -= a;
      const w = pose.wrist;
      const t = pose.tip;
      const k = Math.random();
      s.grains.push({ x: w.x + (t.x - w.x) * k, y: w.y + (t.y - w.y) * k - 0.05, vx: (Math.random() - 0.5) * 0.4, vy: -0.2, amount: a });
    }
    ev.push({ type: "pour" });
  }

  // falling soil
  for (let i = s.grains.length - 1; i >= 0; i--) {
    const g = s.grains[i];
    g.vy -= 9.8 * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    const inBed = s.truckAway === 0 && g.x > TRUCK.x0 + 0.12 && g.x < TRUCK.x1 - 0.12;
    const bedTop = TRUCK.bed + (s.truckLoad / TRUCK.cap) * (TRUCK.wall - TRUCK.bed - 0.05);
    if (inBed && g.y <= bedTop) {
      s.grains.splice(i, 1);
      if (s.truckLoad < TRUCK.cap) {
        const add = Math.min(g.amount, TRUCK.cap - s.truckLoad);
        s.truckLoad += add;
        s.delivered += add;
        s.score += add * POINTS.perArea;
        ev.push({ type: "deliver", amount: add });
        if (s.truckLoad >= TRUCK.cap - 1e-6) {
          s.trucksFilled++;
          s.score += POINTS.fullTruck;
          s.truckAway = 3;
          ev.push({ type: "truckFull" });
        }
      } else deposit(s, g.x, g.amount - 0);
      continue;
    }
    if (inTruckBody(s, g.x, g.y)) {
      // hit the cab / side of the truck: falls off to the nearest side
      g.x = g.x < (TRUCK.x0 + TRUCK.x1) / 2 ? TRUCK.x0 - 0.05 : TRUCK.x1 + 0.05;
    }
    if (g.y <= surfaceAt(s, g.x)) {
      s.grains.splice(i, 1);
      deposit(s, g.x, g.amount);
    }
  }

  // truck drives away when full and a new empty one comes
  if (s.truckAway > 0) {
    s.truckAway = Math.max(0, s.truckAway - dt);
    if (s.truckAway === 0) s.truckLoad = 0;
  }

  relax(s);
  if (s.timeLeft <= 0) s.over = true;
  return ev;
}

/** A full bucket can always be pulled out of the soil; it just can't be pushed deeper. */
function pushedDeeper(depth: number, prevDepth: number) {
  return depth > 0.08 && depth > prevDepth + 1e-4;
}

/** Bucket clear of the ground on this side and of the ground / truck on the other side. */
function swingClear(s: ExcavatorState) {
  const here = armPose(s).tip;
  const there = armPose({ ...s, facing: -s.facing }).tip;
  return (
    here.y >= surfaceAt(s, here.x) + SWING_CLEAR &&
    there.y >= surfaceAt(s, there.x) + SWING_CLEAR &&
    !inTruckBody(s, there.x, there.y - SWING_CLEAR) &&
    there.x > 0.05 &&
    there.x < SCENE.width - 0.05
  );
}

export type SwingResult = "ok" | "busy" | "over";

/**
 * Asks the cab to turn to the other side (truck ↔ soil pile). If the bucket is low, the boom is
 * lifted automatically first, as an operator would. The load stays in the bucket.
 */
export function swing(s: ExcavatorState): SwingResult {
  if (s.over) return "over";
  if (s.swingT < 1 || s.swingPending) return "busy";
  s.swingPending = true;
  return "ok";
}

function carve(s: ExcavatorState, x: number, y: number, room: number) {
  let took = 0;
  const half = 0.18;
  const i0 = Math.max(0, Math.floor((x - half) / SCENE.col));
  const i1 = Math.min(s.heights.length - 1, Math.floor((x + half) / SCENE.col));
  for (let i = i0; i <= i1 && took < room; i++) {
    const h = s.heights[i];
    const target = Math.max(SCENE.bedrock, y);
    if (h <= target) continue;
    const cut = Math.min(h - target, (room - took) / SCENE.col);
    s.heights[i] = h - cut;
    took += cut * SCENE.col;
  }
  return took;
}

function deposit(s: ExcavatorState, x: number, amount: number) {
  const i = Math.max(0, Math.min(s.heights.length - 1, Math.floor(x / SCENE.col)));
  s.heights[i] += amount / SCENE.col;
}

/** Loose soil slides down until slopes are below its angle of repose (≈ 40°). */
function relax(s: ExcavatorState) {
  const h = s.heights;
  const maxStep = SCENE.col * 0.85;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < h.length - 1; i++) {
      const d = h[i] - h[i + 1];
      if (d > maxStep) {
        const m = (d - maxStep) / 2;
        h[i] -= m;
        h[i + 1] += m;
      } else if (-d > maxStep) {
        const m = (-d - maxStep) / 2;
        h[i] += m;
        h[i + 1] -= m;
      }
    }
  }
}

/** Total soil in the scene (ground + bucket + falling + truck), for tests. */
export function totalSoil(s: ExcavatorState) {
  let t = 0;
  for (const v of s.heights) t += (v - SCENE.bedrock) * SCENE.col;
  for (const g of s.grains) t += g.amount;
  return t + s.load + s.pourAcc + s.delivered;
}
