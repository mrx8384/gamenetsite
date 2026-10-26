/**
 * Foot-pool (football billiards) physics, top view, no rendering.
 * Field after upper-floor/foot-pool-field-and-mural.jpg and FOOT_POOL in data/upperFloor.ts:
 * 4.8 × 3.3 m playing area, six pockets (four corners + middle of the long sides).
 * Solo challenge: kick the white ball, pocket all the coloured balls in as few kicks as possible.
 * (No official league rules are assumed.)
 */
export const FIELD = { L: 4.8, W: 3.3, ballR: 0.11, pocketR: 0.21, cornerInset: 0.06 } as const;
export const BALLS = 8;
export const POINTS = { pocket: 100, kick: -10, scratch: -50, finish: 200 } as const;
export const MAX_KICK = 7; // m/s

const ROLL_DECEL = 0.55; // m/s² (carpet)
const DAMP = 0.35; // 1/s, extra slowdown at speed
const BALL_E = 0.93;
const CUSHION_E = 0.72;
const STOP = 0.03;

export interface Ball {
  id: number; // 0 = white
  x: number;
  y: number;
  vx: number;
  vy: number;
  inPocket: boolean;
}

export type PoolEvent = { type: "turn"; player: 0 | 1 } | { type: "kick"; power: number } | { type: "ballHit"; v: number } | { type: "cushion"; v: number } | { type: "pocket"; id: number } | { type: "scratch" } | { type: "cleared" };

export interface PoolState {
  balls: Ball[];
  kicks: number;
  pocketed: number;
  scratches: number;
  score: number;
  elapsed: number;
  over: boolean;
  /** Last kick still rolling. */
  moving: boolean;
  /** Pockets this kick (for messages). */
  turnPockets: number;
  /** Two players taking turns on one device (1 = solo challenge). */
  players: 1 | 2;
  /** Whose kick it is (0 or 1). */
  turn: 0 | 1;
  /** Balls pocketed by each player. */
  balls2: [number, number];
}

/** Pocket centres (x along the long side). */
export const POCKETS = (() => {
  const hx = FIELD.L / 2 - FIELD.cornerInset;
  const hy = FIELD.W / 2 - FIELD.cornerInset;
  return [
    { x: -hx, y: -hy },
    { x: 0, y: -FIELD.W / 2 - 0.04 },
    { x: hx, y: -hy },
    { x: -hx, y: hy },
    { x: 0, y: FIELD.W / 2 + 0.04 },
    { x: hx, y: hy },
  ];
})();

export function createPool(players: 1 | 2 = 1): PoolState {
  const balls: Ball[] = [{ id: 0, x: -FIELD.L / 4, y: 0, vx: 0, vy: 0, inPocket: false }];
  // triangle rack on the far side: rows of 1, 2, 3, 2 (8 balls)
  const d = FIELD.ballR * 2 + 0.005;
  const rows = [1, 2, 3, 2];
  let id = 1;
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      balls.push({ id: id++, x: FIELD.L / 4 + r * d * 0.87, y: (i - (n - 1) / 2) * d, vx: 0, vy: 0, inPocket: false });
    }
  });
  return { balls, kicks: 0, pocketed: 0, scratches: 0, score: 0, elapsed: 0, over: false, moving: false, turnPockets: 0, players, turn: 0, balls2: [0, 0] };
}

export function cueBall(s: PoolState) {
  return s.balls[0];
}

/** Kicks the white ball in direction (dx, dy) with power 0..1. Only when everything has stopped. */
export function kick(s: PoolState, dx: number, dy: number, power: number): PoolEvent[] {
  if (s.moving || s.over) return [];
  const l = Math.hypot(dx, dy);
  if (l < 1e-6 || power <= 0.02) return [];
  const p = Math.min(1, power);
  const c = cueBall(s);
  c.vx = (dx / l) * p * MAX_KICK;
  c.vy = (dy / l) * p * MAX_KICK;
  s.kicks++;
  s.score += POINTS.kick;
  s.moving = true;
  s.turnPockets = 0;
  return [{ type: "kick", power: p }];
}

export function stepPool(s: PoolState, dtIn: number): PoolEvent[] {
  const ev: PoolEvent[] = [];
  if (s.over) return ev;
  const dtAll = Math.min(dtIn, 0.05);
  s.elapsed += dtAll;
  if (!s.moving) return ev;
  const steps = Math.max(1, Math.ceil(dtAll / (1 / 240)));
  const dt = dtAll / steps;
  const r = FIELD.ballR;
  const live = s.balls.filter((b) => !b.inPocket);
  for (let k = 0; k < steps; k++) {
    for (const b of live) {
      if (b.inPocket) continue;
      const v = Math.hypot(b.vx, b.vy);
      if (v > 0) {
        const nv = Math.max(0, v - (ROLL_DECEL + DAMP * v) * dt);
        b.vx *= nv / v;
        b.vy *= nv / v;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // pockets
      for (const p of POCKETS) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < FIELD.pocketR) {
          b.inPocket = true;
          b.vx = b.vy = 0;
          if (b.id === 0) ev.push({ type: "scratch" });
          else {
            ev.push({ type: "pocket", id: b.id });
            s.pocketed++;
            s.turnPockets++;
            s.balls2[s.turn]++;
            s.score += POINTS.pocket;
          }
          break;
        }
      }
      if (b.inPocket) continue;
      // cushions (the pocket mouths are open)
      const hx = FIELD.L / 2 - r;
      const hy = FIELD.W / 2 - r;
      if (b.x < -hx || b.x > hx) {
        b.x = b.x < 0 ? -hx : hx;
        ev.push({ type: "cushion", v: Math.abs(b.vx) });
        b.vx = -b.vx * CUSHION_E;
        b.vy *= 0.92;
      }
      if (b.y < -hy || b.y > hy) {
        b.y = b.y < 0 ? -hy : hy;
        ev.push({ type: "cushion", v: Math.abs(b.vy) });
        b.vy = -b.vy * CUSHION_E;
        b.vx *= 0.92;
      }
    }
    // ball–ball (equal masses)
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      if (a.inPocket) continue;
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        if (b.inPocket) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= 2 * r || d < 1e-9) continue;
        const nx = dx / d;
        const ny = dy / d;
        const push = (2 * r - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel <= 0) continue;
        const j2 = ((1 + BALL_E) / 2) * rel;
        a.vx -= j2 * nx;
        a.vy -= j2 * ny;
        b.vx += j2 * nx;
        b.vy += j2 * ny;
        ev.push({ type: "ballHit", v: rel });
      }
    }
    // everything at rest?
    let still = true;
    for (const b of live) {
      if (b.inPocket) continue;
      if (Math.hypot(b.vx, b.vy) < STOP) b.vx = b.vy = 0;
      else still = false;
    }
    if (still) {
      endOfKick(s, ev);
      break;
    }
  }
  return ev;
}

function endOfKick(s: PoolState, ev: PoolEvent[]) {
  s.moving = false;
  const c = cueBall(s);
  const scratched = c.inPocket;
  if (c.inPocket) {
    // white ball back on its spot (or the nearest free place)
    s.scratches++;
    s.score += POINTS.scratch;
    c.inPocket = false;
    c.vx = c.vy = 0;
    const spot = freeSpot(s, -FIELD.L / 4, 0);
    c.x = spot.x;
    c.y = spot.y;
  }
  if (s.pocketed >= BALLS) {
    s.score += POINTS.finish;
    s.over = true;
    ev.push({ type: "cleared" });
    return;
  }
  // two players: pocket a ball and you kick again; a miss or a dropped white ball passes the turn
  if (s.players === 2 && (s.turnPockets === 0 || scratched)) {
    s.turn = s.turn === 0 ? 1 : 0;
    ev.push({ type: "turn", player: s.turn });
  }
}

function freeSpot(s: PoolState, x: number, y: number) {
  const r = FIELD.ballR;
  for (let ring = 0; ring < 20; ring++) {
    for (let a = 0; a < 12; a++) {
      const px = x + Math.cos((a / 12) * Math.PI * 2) * ring * r * 1.2;
      const py = y + Math.sin((a / 12) * Math.PI * 2) * ring * r * 1.2;
      if (Math.abs(px) > FIELD.L / 2 - r || Math.abs(py) > FIELD.W / 2 - r) continue;
      if (s.balls.every((b) => b.id === 0 || b.inPocket || Math.hypot(b.x - px, b.y - py) > 2.05 * r)) return { x: px, y: py };
    }
  }
  return { x, y };
}

/** Where the white ball would first touch something along (dx, dy): for the aiming guide. */
export function aimGuide(s: PoolState, dx: number, dy: number) {
  const c = cueBall(s);
  const l = Math.hypot(dx, dy) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const r = FIELD.ballR;
  let t = Infinity;
  let hit: Ball | null = null;
  for (const b of s.balls) {
    if (b.id === 0 || b.inPocket) continue;
    // ray vs circle of radius 2r around b
    const ox = c.x - b.x;
    const oy = c.y - b.y;
    const bq = ox * ux + oy * uy;
    const cq = ox * ox + oy * oy - 4 * r * r;
    const disc = bq * bq - cq;
    if (disc < 0) continue;
    const tt = -bq - Math.sqrt(disc);
    if (tt > 0 && tt < t) {
      t = tt;
      hit = b;
    }
  }
  // cushion
  const hx = FIELD.L / 2 - r;
  const hy = FIELD.W / 2 - r;
  const tx = ux > 0 ? (hx - c.x) / ux : ux < 0 ? (-hx - c.x) / ux : Infinity;
  const ty = uy > 0 ? (hy - c.y) / uy : uy < 0 ? (-hy - c.y) / uy : Infinity;
  const tw = Math.min(tx, ty);
  if (tw < t) {
    t = tw;
    hit = null;
  }
  return { x: c.x + ux * t, y: c.y + uy * t, hit };
}
