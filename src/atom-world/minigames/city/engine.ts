/**
 * «شهر اتم»: a small open city in the style of the GTA games (drawn in 3D by CityScene.tsx) — but without
 * violence (players are often children): walk, get into a parked car or the taxi, drive through
 * traffic, do taxi jobs (pick a passenger up, drop them off before time runs out) and collect
 * coins. Pedestrians always jump aside; crashing damages the car until it smokes and you need
 * another one. Pure logic (no DOM), unit-tested. Units are metres; x right, y down (north = −y).
 */
import type { Difficulty } from "../types";

export const P = 20; // one city block + its road
export const ROAD = 5; // road width (two lanes)
export const WALK = 1.6; // sidewalk width
export const N = 7; // blocks per side
export const SIZE = N * P + ROAD;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface Building extends Rect {
  color: string;
  roof: string;
  name?: string;
  club?: boolean;
}
export interface Tree {
  x: number;
  y: number;
  r: number;
}
export type CarKind = "player-taxi" | "parked" | "traffic";
export interface Car {
  id: number;
  kind: CarKind;
  x: number;
  y: number;
  angle: number; // radians, 0 = east (+x), π/2 = south (+y)
  speed: number;
  color: string;
  health: number;
  /** traffic: lane axis and direction (+1 / −1). */
  lane?: { axis: "x" | "y"; dir: 1 | -1; next: number };
}
export interface Ped {
  x: number;
  y: number;
  axis: "x" | "y";
  dir: 1 | -1;
  dodge: number;
  color: string;
}
export interface Spot {
  x: number;
  y: number;
  name: string;
}
export interface Mission {
  stage: "pickup" | "dropoff";
  pickup: Spot;
  dest: Spot;
  timeLeft: number;
}
export interface CityInput {
  /** walk / steer (right +) */
  x: number;
  /** walk (up +) / throttle (+) and brake / reverse (−) */
  y: number;
  handbrake: boolean;
  /** enter / leave a car (pressed this frame) */
  action: boolean;
}
export interface CityState {
  difficulty: Difficulty;
  time: number;
  left: number;
  money: number;
  deliveries: number;
  coinsTaken: number;
  crashes: number;
  player: { x: number; y: number; heading: number; car: number | null; walk: number };
  cars: Car[];
  peds: Ped[];
  buildings: Building[];
  trees: Tree[];
  coins: { x: number; y: number }[];
  mission: Mission | null;
  /** short message for the screen (Persian), and when it was set */
  note: { text: string; t: number } | null;
  over: boolean;
  rand: () => number;
}

const COLORS = ["#d94f4f", "#3a7bd5", "#f2b705", "#7c8a99", "#eeeeee", "#2bb673", "#9b59b6", "#222831"];
const BUILD = ["#c9b79c", "#b08d74", "#8fa3b0", "#d6c8b4", "#a0a8b5", "#c7a07f"];
const ROOF = ["#5d6670", "#6e5a4e", "#4b5a66", "#7b6d60"];
const PLACES = ["کتابخانه", "سینما", "نانوایی", "ایستگاه مترو", "استادیوم", "بازار", "مدرسه", "موزه", "پارک بزرگ", "کافه", "فروشگاه", "باشگاه"];

const LEVEL: Record<Difficulty, { time: number; traffic: number; peds: number }> = {
  easy: { time: 240, traffic: 10, peds: 16 },
  normal: { time: 180, traffic: 16, peds: 22 },
  hard: { time: 150, traffic: 24, peds: 28 },
};

export const CAR = { r: 1.1, len: 4.2, wid: 2.0, maxSpeed: 22, reverse: -6, accel: 9, brake: 16, drag: 1.4 } as const;
export const WALK_SPEED = 4.2;

// ── city layout

/** Is (x, y) on a road (not a block)? */
export function onRoad(x: number, y: number) {
  const mx = ((x % P) + P) % P;
  const my = ((y % P) + P) % P;
  return mx < ROAD || my < ROAD;
}

export const inCity = (x: number, y: number, m = 0) => x >= m && y >= m && x <= SIZE - m && y <= SIZE - m;

/** Block (i, j) interior, sidewalks included. */
export const block = (i: number, j: number): Rect => ({ x0: i * P + ROAD, y0: j * P + ROAD, x1: (i + 1) * P, y1: (j + 1) * P });

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The same city every time (seeded): buildings, parks with trees, parking lots, the ATOM club. */
export function buildCity() {
  const r = seeded(1404);
  const buildings: Building[] = [];
  const trees: Tree[] = [];
  const parking: { x: number; y: number; angle: number }[] = [];
  const club = { i: 3, j: 3 };
  let place = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const b = block(i, j);
      const lot = { x0: b.x0 + WALK, y0: b.y0 + WALK, x1: b.x1 - WALK, y1: b.y1 - WALK };
      if (i === club.i && j === club.j) {
        buildings.push({ ...lot, color: "#101214", roof: "#1b1f22", name: "اتم گیم کلاب", club: true });
        continue;
      }
      const roll = r();
      if (roll < 0.16) {
        // park
        for (let k = 0; k < 6; k++) trees.push({ x: lot.x0 + 1.5 + r() * (lot.x1 - lot.x0 - 3), y: lot.y0 + 1.5 + r() * (lot.y1 - lot.y0 - 3), r: 0.7 + r() * 0.4 });
      } else if (roll < 0.28) {
        // parking lot: cars along its top edge
        for (let k = 0; k < 3; k++) parking.push({ x: lot.x0 + 2.2 + k * 3.6, y: lot.y0 + 2.4, angle: Math.PI / 2 });
      } else {
        const split = r() < 0.5;
        const name = r() < 0.6 ? PLACES[place++ % PLACES.length] : undefined;
        const c = () => BUILD[Math.floor(r() * BUILD.length)];
        const rf = () => ROOF[Math.floor(r() * ROOF.length)];
        if (split) {
          const mid = (lot.x0 + lot.x1) / 2;
          buildings.push({ x0: lot.x0, y0: lot.y0, x1: mid - 0.4, y1: lot.y1, color: c(), roof: rf(), name });
          buildings.push({ x0: mid + 0.4, y0: lot.y0, x1: lot.x1, y1: lot.y1, color: c(), roof: rf() });
        } else buildings.push({ ...lot, color: c(), roof: rf(), name });
      }
    }
  return { buildings, trees, parking };
}

/** Points on the sidewalks (for passengers, coins, starts): the middle of a block's edge. */
function sidewalkSpot(r: () => number) {
  const i = Math.floor(r() * N);
  const j = Math.floor(r() * N);
  const b = block(i, j);
  const side = Math.floor(r() * 4);
  const t = 0.2 + r() * 0.6;
  const w = WALK / 2;
  if (side === 0) return { x: b.x0 + (b.x1 - b.x0) * t, y: b.y0 + w, axis: "x" as const };
  if (side === 1) return { x: b.x1 - w, y: b.y0 + (b.y1 - b.y0) * t, axis: "y" as const };
  if (side === 2) return { x: b.x0 + (b.x1 - b.x0) * t, y: b.y1 - w, axis: "x" as const };
  return { x: b.x0 + w, y: b.y0 + (b.y1 - b.y0) * t, axis: "y" as const };
}

/** Lane centre of a road for a direction (drive on the right). */
function laneCoord(roadIndex: number, axis: "x" | "y", dir: 1 | -1) {
  // moving along x: lane is a y coordinate; eastbound (+1) keeps to the south half
  if (axis === "x") return roadIndex * P + (dir === 1 ? ROAD * 0.75 : ROAD * 0.25);
  // moving along y: southbound (+1) keeps to the west half
  return roadIndex * P + (dir === 1 ? ROAD * 0.25 : ROAD * 0.75);
}

const angleOf = (axis: "x" | "y", dir: 1 | -1) => (axis === "x" ? (dir === 1 ? 0 : Math.PI) : dir === 1 ? Math.PI / 2 : -Math.PI / 2);

/** Next intersection centre ahead along a lane. */
function nextCross(pos: number, dir: 1 | -1) {
  const c = ROAD / 2;
  const k = dir === 1 ? Math.floor((pos - c) / P) + 1 : Math.ceil((pos - c) / P) - 1;
  return k * P + c;
}

let carId = 0;

export function createCity(difficulty: Difficulty = "normal", rand: () => number = Math.random): CityState {
  const { buildings, trees, parking } = buildCity();
  const lv = LEVEL[difficulty];
  const cars: Car[] = [];
  // start on the sidewalk beside the ATOM club, the green ATOM taxi parked at the kerb in front
  const taxi = { x: 3 * P + ROAD + 0.4, y: 3 * P + ROAD + 5 };
  const start = { x: 3 * P + ROAD + WALK / 2, y: taxi.y + 2.6 };
  cars.push({ id: carId++, kind: "player-taxi", x: taxi.x, y: taxi.y, angle: -Math.PI / 2, speed: 0, color: "#39ff88", health: 100 });
  for (const p of parking) cars.push({ id: carId++, kind: "parked", x: p.x, y: p.y, angle: p.angle, speed: 0, color: COLORS[Math.floor(rand() * COLORS.length)], health: 100 });
  for (let k = 0; k < lv.traffic; k++) {
    const axis: "x" | "y" = rand() < 0.5 ? "x" : "y";
    const dir: 1 | -1 = rand() < 0.5 ? 1 : -1;
    const road = Math.floor(rand() * (N + 1));
    const along = 3 + rand() * (SIZE - 6);
    const lc = laneCoord(road, axis, dir);
    const x = axis === "x" ? along : lc;
    const y = axis === "x" ? lc : along;
    cars.push({ id: carId++, kind: "traffic", x, y, angle: angleOf(axis, dir), speed: 6 + rand() * 3, color: COLORS[Math.floor(rand() * COLORS.length)], health: 100, lane: { axis, dir, next: nextCross(along, dir) } });
  }
  const peds: Ped[] = [];
  for (let k = 0; k < lv.peds; k++) {
    const s = sidewalkSpot(rand);
    peds.push({ ...s, dir: rand() < 0.5 ? 1 : -1, dodge: 0, color: ["#ff4fa3", "#39ff88", "#f2b705", "#6c9bff", "#ffffff"][k % 5] });
  }
  const coins = Array.from({ length: 24 }, () => {
    const c = sidewalkSpot(rand);
    return { x: c.x, y: c.y };
  });
  const s: CityState = {
    difficulty,
    time: 0,
    left: lv.time,
    money: 0,
    deliveries: 0,
    coinsTaken: 0,
    crashes: 0,
    player: { x: start.x, y: start.y, heading: -Math.PI / 2, car: null, walk: 0 },
    cars,
    peds,
    buildings,
    trees,
    coins,
    mission: null,
    note: { text: "سوار تاکسی سبز اتم شوید (دکمهٔ «سوار شو») و مسافرها را برسانید!", t: 0 },
    over: false,
    rand,
  };
  newMission(s);
  return s;
}

// ── collisions

function solidAt(s: CityState, x: number, y: number, r: number): { nx: number; ny: number; depth: number } | null {
  if (x < r) return { nx: 1, ny: 0, depth: r - x };
  if (y < r) return { nx: 0, ny: 1, depth: r - y };
  if (x > SIZE - r) return { nx: -1, ny: 0, depth: x - (SIZE - r) };
  if (y > SIZE - r) return { nx: 0, ny: -1, depth: y - (SIZE - r) };
  for (const b of s.buildings) {
    const cx = Math.max(b.x0, Math.min(x, b.x1));
    const cy = Math.max(b.y0, Math.min(y, b.y1));
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.hypot(dx, dy);
    if (d < r) {
      if (d > 1e-6) return { nx: dx / d, ny: dy / d, depth: r - d };
      // centre inside: push out the shortest way
      const opts = [
        { nx: -1, ny: 0, depth: x - b.x0 + r },
        { nx: 1, ny: 0, depth: b.x1 - x + r },
        { nx: 0, ny: -1, depth: y - b.y0 + r },
        { nx: 0, ny: 1, depth: b.y1 - y + r },
      ];
      return opts.sort((a, c) => a.depth - c.depth)[0];
    }
  }
  for (const t of s.trees) {
    const dx = x - t.x;
    const dy = y - t.y;
    const d = Math.hypot(dx, dy);
    if (d < r + t.r * 0.5 && d > 1e-6) return { nx: dx / d, ny: dy / d, depth: r + t.r * 0.5 - d };
  }
  return null;
}

/** Moves a circle, sliding along walls. Returns the hit normal (or null). */
function moveCircle(s: CityState, o: { x: number; y: number }, dx: number, dy: number, r: number) {
  o.x += dx;
  o.y += dy;
  let hit: { nx: number; ny: number; depth: number } | null = null;
  for (let k = 0; k < 3; k++) {
    const c = solidAt(s, o.x, o.y, r);
    if (!c) break;
    o.x += c.nx * c.depth;
    o.y += c.ny * c.depth;
    hit = c;
  }
  return hit;
}

// ── missions, coins

function farSpot(s: CityState, from: { x: number; y: number }, min: number) {
  for (let k = 0; k < 40; k++) {
    const p = sidewalkSpot(s.rand);
    if (Math.hypot(p.x - from.x, p.y - from.y) >= min) return p;
  }
  return sidewalkSpot(s.rand);
}

/** Name of the building nearest to a point (where the passenger wants to go). */
function placeNear(s: CityState, p: { x: number; y: number }) {
  let best = "";
  let d = Infinity;
  for (const b of s.buildings) {
    if (!b.name) continue;
    const dd = Math.hypot((b.x0 + b.x1) / 2 - p.x, (b.y0 + b.y1) / 2 - p.y);
    if (dd < d) {
      d = dd;
      best = b.name;
    }
  }
  return d < 16 ? best : "";
}

export function newMission(s: CityState) {
  const p = s.player;
  const pu = farSpot(s, p, 18);
  const pickup = { x: pu.x, y: pu.y };
  // every third job goes to the club, the others somewhere far away
  const toClub = s.deliveries % 3 === 2;
  const club = s.buildings.find((b) => b.club)!;
  const far = farSpot(s, pickup, 45);
  const destPt = toClub ? { x: (club.x0 + club.x1) / 2, y: club.y1 + WALK / 2 } : { x: far.x, y: far.y };
  const dest = { ...destPt, name: toClub ? "اتم گیم کلاب" : placeNear(s, destPt) || "مقصد" };
  s.mission = { stage: "pickup", pickup: { ...pickup, name: "مسافر" }, dest, timeLeft: 25 + Math.hypot(p.x - pickup.x, p.y - pickup.y) / 6 };
}

export const PICKUP_R = 3.6;
export const COIN_R = 1.3;

function say(s: CityState, text: string) {
  s.note = { text, t: s.time };
}

// ── step

export function nearestCar(s: CityState, max = 3.2) {
  let best: Car | null = null;
  let d = max;
  for (const c of s.cars) {
    if (c.kind === "traffic") continue;
    const dd = Math.hypot(c.x - s.player.x, c.y - s.player.y);
    if (dd < d) {
      d = dd;
      best = c;
    }
  }
  return best;
}

export function stepCity(s: CityState, dt: number, input: CityInput) {
  if (s.over) return;
  s.time += dt;
  s.left = Math.max(0, s.left - dt);
  if (s.left <= 0) {
    s.over = true;
    return;
  }
  const p = s.player;
  const driving = p.car !== null ? s.cars.find((c) => c.id === p.car)! : null;

  // enter / leave
  if (input.action) {
    if (driving) {
      if (Math.abs(driving.speed) < 3) {
        driving.speed = 0;
        driving.kind = driving.kind === "player-taxi" ? "player-taxi" : "parked";
        p.car = null;
        // step out on the left side of the car
        const lx = Math.cos(driving.angle - Math.PI / 2) * 1.7;
        const ly = Math.sin(driving.angle - Math.PI / 2) * 1.7;
        p.x = driving.x + lx;
        p.y = driving.y + ly;
        moveCircle(s, p, 0, 0, 0.4);
      } else say(s, "اول ماشین را نگه دارید.");
    } else {
      const c = nearestCar(s);
      if (c && c.health > 0) {
        p.car = c.id;
        say(s, c.kind === "player-taxi" ? "تاکسی اتم آماده است!" : "سوار شدید.");
      } else if (c) say(s, "این ماشین خراب است؛ یکی دیگر پیدا کنید.");
      else say(s, "به یک ماشین پارک‌شده نزدیک شوید.");
    }
  }

  const car = p.car !== null ? s.cars.find((c) => c.id === p.car)! : null;
  if (car) driveCar(s, car, input, dt);
  else {
    const vx = input.x;
    const vy = -input.y;
    const len = Math.hypot(vx, vy);
    if (len > 0.05) {
      const k = Math.min(1, len) / len;
      moveCircle(s, p, vx * k * WALK_SPEED * dt, vy * k * WALK_SPEED * dt, 0.4);
      p.heading = Math.atan2(vy, vx);
      p.walk += dt * 8;
    }
    // people on foot do not walk through cars
    for (const c of s.cars) {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < CAR.r + 0.4 && d > 1e-6) {
        p.x = c.x + (dx / d) * (CAR.r + 0.4);
        p.y = c.y + (dy / d) * (CAR.r + 0.4);
      }
    }
  }

  stepTraffic(s, dt);
  stepPeds(s, dt);

  // coins
  for (const c of s.coins) {
    if (Math.hypot(c.x - p.x, c.y - p.y) < COIN_R + (car ? 0.8 : 0)) {
      s.money += 5;
      s.coinsTaken++;
      const n = farSpot(s, p, 30);
      c.x = n.x;
      c.y = n.y;
    }
  }

  // taxi job
  const m = s.mission;
  if (m) {
    m.timeLeft -= dt;
    const slow = car && Math.abs(car.speed) < 2.5;
    if (m.stage === "pickup" && car && slow && Math.hypot(m.pickup.x - car.x, m.pickup.y - car.y) < PICKUP_R) {
      m.stage = "dropoff";
      m.timeLeft = 12 + Math.hypot(m.dest.x - m.pickup.x, m.dest.y - m.pickup.y) / 5.5;
      say(s, `مسافر سوار شد: «${m.dest.name}» لطفاً!`);
    } else if (m.stage === "dropoff" && car && slow && Math.hypot(m.dest.x - car.x, m.dest.y - car.y) < PICKUP_R) {
      const reward = 40 + Math.round(Math.max(0, m.timeLeft) * 2);
      s.money += reward;
      s.deliveries++;
      say(s, `رسیدیم! کرایه: ${reward.toLocaleString("fa-IR")}`);
      newMission(s);
    } else if (m.timeLeft <= 0) {
      say(s, m.stage === "pickup" ? "مسافر منتظر نماند؛ مسافر بعدی…" : "دیر شد؛ مسافر پیاده شد.");
      newMission(s);
    }
  }
}

function driveCar(s: CityState, c: Car, input: CityInput, dt: number) {
  const broken = c.health <= 0;
  const thr = broken ? 0 : input.y;
  if (thr > 0.05) c.speed += (c.speed < 0 ? CAR.brake : CAR.accel) * thr * dt;
  else if (thr < -0.05) c.speed -= (c.speed > 0 ? CAR.brake : CAR.accel * 0.6) * -thr * dt;
  else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), CAR.drag * dt);
  if (input.handbrake) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), CAR.brake * 1.3 * dt);
  c.speed = Math.max(CAR.reverse, Math.min(CAR.maxSpeed * (c.health < 30 ? 0.6 : 1), c.speed));
  const grip = Math.min(1, Math.abs(c.speed) / 4);
  c.angle += input.x * grip * (input.handbrake ? 3.2 : 2.2) * Math.sign(c.speed || 1) * dt;
  const before = c.speed;
  const hit = moveCircle(s, c, Math.cos(c.angle) * c.speed * dt, Math.sin(c.angle) * c.speed * dt, CAR.r);
  if (hit) crash(s, c, Math.abs(before));
  // other cars
  for (const o of s.cars) {
    if (o === c) continue;
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < CAR.r * 2 && d > 1e-6) {
      const push = CAR.r * 2 - d;
      c.x += (dx / d) * push * 0.6;
      c.y += (dy / d) * push * 0.6;
      o.x -= (dx / d) * push * 0.4;
      o.y -= (dy / d) * push * 0.4;
      crash(s, c, Math.abs(c.speed - (o.speed || 0) * 0.5));
      o.speed *= 0.3;
    }
  }
  s.player.x = c.x;
  s.player.y = c.y;
  s.player.heading = c.angle;
}

function crash(s: CityState, c: Car, impact: number) {
  if (impact > 4) {
    c.health = Math.max(0, c.health - impact * 2.2);
    s.crashes++;
    if (c.health <= 0) say(s, "ماشین دود کرد! پیاده شوید و ماشین دیگری پیدا کنید.");
  }
  c.speed *= -0.25;
}

function stepTraffic(s: CityState, dt: number) {
  for (const c of s.cars) {
    if (c.kind !== "traffic" || !c.lane || c.id === s.player.car) continue;
    const L = c.lane;
    // slow down for anything right in front (the player on foot, their car, other traffic)
    const fx = Math.cos(c.angle);
    const fy = Math.sin(c.angle);
    let blocked = false;
    const near = (x: number, y: number, dist: number) => {
      const dx = x - c.x;
      const dy = y - c.y;
      const ahead = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      return ahead > 0 && ahead < dist && side < 1.4;
    };
    if (near(s.player.x, s.player.y, 7)) blocked = true;
    for (const o of s.cars) if (o !== c && near(o.x, o.y, 6)) blocked = true;
    const want = blocked ? 0 : 7.5;
    c.speed += Math.sign(want - c.speed) * Math.min(Math.abs(want - c.speed), (blocked ? 18 : 4) * dt);
    const along = L.axis === "x" ? c.x : c.y;
    let next = along + L.dir * c.speed * dt;
    // turn at some intersections (inside the city)
    if ((L.dir === 1 && next >= L.next) || (L.dir === -1 && next <= L.next)) {
      const crossRoad = Math.round((L.next - ROAD / 2) / P);
      const laneRoad = Math.round(((L.axis === "x" ? c.y : c.x) - ROAD / 2) / P);
      if (crossRoad >= 0 && crossRoad <= N && s.rand() < 0.35) {
        const axis: "x" | "y" = L.axis === "x" ? "y" : "x";
        const dir: 1 | -1 = s.rand() < 0.5 ? 1 : -1;
        const lc = laneCoord(crossRoad, axis, dir);
        const pos = laneRoad * P + ROAD / 2;
        if (axis === "x") {
          c.y = lc;
          c.x = pos;
        } else {
          c.x = lc;
          c.y = pos;
        }
        c.lane = { axis, dir, next: nextCross(pos, dir) };
        c.angle = angleOf(axis, dir);
        continue;
      }
      L.next = nextCross(L.next, L.dir);
    }
    // leave the city on one side, come back on the other
    if (next < 0 || next > SIZE) {
      next = next < 0 ? next + SIZE : next - SIZE;
      L.next = nextCross(next, L.dir);
    }
    if (L.axis === "x") c.x = next;
    else c.y = next;
  }
}

function stepPeds(s: CityState, dt: number) {
  const pc = s.player.car !== null ? s.cars.find((c) => c.id === s.player.car)! : null;
  for (const ped of s.peds) {
    // everyone walks along their sidewalk and turns back at the block's end
    const speed = 1.3;
    if (ped.axis === "x") ped.x += ped.dir * speed * dt;
    else ped.y += ped.dir * speed * dt;
    const pos = ped.axis === "x" ? ped.x : ped.y;
    const inBlock = ((pos % P) + P) % P;
    if (inBlock < ROAD + 0.3 || inBlock > P - 0.3) ped.dir = (ped.dir * -1) as 1 | -1;
    // a car comes: jump aside (no one gets hurt in the ATOM city)
    for (const c of pc ? [pc, ...s.cars] : s.cars) {
      const dx = ped.x - c.x;
      const dy = ped.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < CAR.r + 0.9 && d > 1e-6) {
        ped.x = c.x + (dx / d) * (CAR.r + 0.9);
        ped.y = c.y + (dy / d) * (CAR.r + 0.9);
        ped.dodge = 0.6;
      }
    }
    ped.dodge = Math.max(0, ped.dodge - dt);
    const fix = solidAt(s, ped.x, ped.y, 0.3);
    if (fix) {
      ped.x += fix.nx * fix.depth;
      ped.y += fix.ny * fix.depth;
    }
  }
}
