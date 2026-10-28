import type { Difficulty } from "../types";

/**
 * «گریم صورت» — pure rules (no DOM): the requested designs, the paint grid and the score.
 *
 * Everything is in face coordinates: u (left → right) and v (top → bottom) in 0..1 over the square
 * that holds the face. The face is the oval FACE; paint outside it does not stick.
 */
export const FACE = { cx: 0.5, cy: 0.53, rx: 0.4, ry: 0.46 } as const;
export const EYES: [number, number][] = [
  [0.36, 0.47],
  [0.64, 0.47],
];
export const MOUTH = { x: 0.5, y: 0.75 } as const;

export const COLORS = [
  { id: "red", hex: "#e8303a", name: "قرمز" },
  { id: "orange", hex: "#ff8a1f", name: "نارنجی" },
  { id: "yellow", hex: "#ffd23a", name: "زرد" },
  { id: "green", hex: "#2fbf5b", name: "سبز" },
  { id: "blue", hex: "#2f7bff", name: "آبی" },
  { id: "purple", hex: "#8b4dff", name: "بنفش" },
  { id: "pink", hex: "#ff6fb5", name: "صورتی" },
  { id: "black", hex: "#1c1c22", name: "مشکی" },
  { id: "white", hex: "#ffffff", name: "سفید" },
] as const;
export type ColorId = (typeof COLORS)[number]["id"];
/** Grid value of a colour (0 = no paint). */
export const colorIndex = (c: ColorId) => COLORS.findIndex((x) => x.id === c) + 1;

type P = [number, number];
/** A painted shape: a line (width in face units) or a filled polygon. */
export type Shape = { color: ColorId; line: P[]; width: number } | { color: ColorId; fill: P[] };

export interface Design {
  id: string;
  name: string;
  emoji: string;
  shapes: Shape[];
}

const circle = (cx: number, cy: number, r: number, n = 18, sy = 1): P[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * sy * Math.sin((i / n) * Math.PI * 2)]);
const star = (cx: number, cy: number, r: number): P[] =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
const heart = (cx: number, cy: number, s: number): P[] =>
  Array.from({ length: 24 }, (_, i) => {
    const t = (i / 24) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [cx + (x / 17) * s, cy - (y / 17) * s];
  });
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 14): P[] => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos(a0 + ((a1 - a0) * i) / n), cy + r * Math.sin(a0 + ((a1 - a0) * i) / n)]);

/** The designs children can ask for (generic motifs, no characters from films or brands). */
export const DESIGNS: Design[] = [
  { id: "star", name: "ستارهٔ طلایی", emoji: "⭐", shapes: [{ color: "yellow", fill: star(0.27, 0.64, 0.11) }] },
  { id: "heart", name: "قلب قرمز", emoji: "❤️", shapes: [{ color: "red", fill: heart(0.73, 0.64, 0.1) }] },
  {
    id: "butterfly",
    name: "پروانه",
    emoji: "🦋",
    shapes: [
      { color: "purple", fill: circle(0.34, 0.43, 0.12, 20, 0.8) },
      { color: "purple", fill: circle(0.66, 0.43, 0.12, 20, 0.8) },
      { color: "pink", fill: circle(0.37, 0.56, 0.07, 16, 0.8) },
      { color: "pink", fill: circle(0.63, 0.56, 0.07, 16, 0.8) },
      { color: "black", line: [[0.5, 0.36], [0.5, 0.58]], width: 0.035 },
    ],
  },
  {
    id: "cat",
    name: "گربهٔ ملوس",
    emoji: "🐱",
    shapes: [
      { color: "black", fill: [[0.45, 0.6], [0.55, 0.6], [0.5, 0.67]] },
      { color: "black", line: [[0.38, 0.64], [0.2, 0.6]], width: 0.018 },
      { color: "black", line: [[0.38, 0.67], [0.19, 0.68]], width: 0.018 },
      { color: "black", line: [[0.38, 0.7], [0.21, 0.76]], width: 0.018 },
      { color: "black", line: [[0.62, 0.64], [0.8, 0.6]], width: 0.018 },
      { color: "black", line: [[0.62, 0.67], [0.81, 0.68]], width: 0.018 },
      { color: "black", line: [[0.62, 0.7], [0.79, 0.76]], width: 0.018 },
    ],
  },
  {
    id: "rainbow",
    name: "رنگین‌کمان",
    emoji: "🌈",
    shapes: [
      { color: "red", line: arc(0.5, 0.36, 0.2, Math.PI * 1.1, Math.PI * 1.9), width: 0.035 },
      { color: "yellow", line: arc(0.5, 0.36, 0.165, Math.PI * 1.1, Math.PI * 1.9), width: 0.035 },
      { color: "green", line: arc(0.5, 0.36, 0.13, Math.PI * 1.1, Math.PI * 1.9), width: 0.035 },
      { color: "blue", line: arc(0.5, 0.36, 0.095, Math.PI * 1.1, Math.PI * 1.9), width: 0.035 },
    ],
  },
  {
    id: "tiger",
    name: "ببر کوچولو",
    emoji: "🐯",
    shapes: [
      { color: "orange", fill: circle(0.5, 0.25, 0.17, 20, 0.45) },
      { color: "black", line: [[0.42, 0.19], [0.45, 0.29]], width: 0.03 },
      { color: "black", line: [[0.5, 0.17], [0.5, 0.3]], width: 0.03 },
      { color: "black", line: [[0.58, 0.19], [0.55, 0.29]], width: 0.03 },
      { color: "black", line: [[0.16, 0.6], [0.28, 0.63]], width: 0.03 },
      { color: "black", line: [[0.18, 0.69], [0.29, 0.69]], width: 0.03 },
      { color: "black", line: [[0.84, 0.6], [0.72, 0.63]], width: 0.03 },
      { color: "black", line: [[0.82, 0.69], [0.71, 0.69]], width: 0.03 },
    ],
  },
  {
    id: "flower",
    name: "گل بهاری",
    emoji: "🌸",
    shapes: [
      ...[0, 1, 2, 3, 4].map((i): Shape => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        return { color: "pink", fill: circle(0.73 + 0.055 * Math.cos(a), 0.64 + 0.055 * Math.sin(a), 0.04, 14) };
      }),
      { color: "yellow", fill: circle(0.73, 0.64, 0.035, 14) },
      { color: "green", line: [[0.6, 0.52], [0.66, 0.58]], width: 0.022 },
    ],
  },
];

/** Paint grid resolution (cells per side of the face square). */
export const GRID = 48;

export const insideFace = (u: number, v: number) => ((u - FACE.cx) / FACE.rx) ** 2 + ((v - FACE.cy) / FACE.ry) ** 2 <= 1;

function segDist(px: number, py: number, a: P, b: P) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}

function inPolygon(x: number, y: number, poly: P[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const cellCenter = (i: number) => (i + 0.5) / GRID;

/** The design as a grid of colour indices (0 = bare skin). */
export function rasterize(design: Design): Uint8Array {
  const g = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++)
    for (let x = 0; x < GRID; x++) {
      const u = cellCenter(x);
      const v = cellCenter(y);
      if (!insideFace(u, v)) continue;
      for (const s of design.shapes) {
        const hit = "fill" in s ? inPolygon(u, v, s.fill) : s.line.some((p, i) => i > 0 && segDist(u, v, s.line[i - 1], p) <= s.width / 2 + 0.5 / GRID);
        if (hit) g[y * GRID + x] = colorIndex(s.color);
      }
    }
  return g;
}

/** One brush dab (radius in face units); colour 0 erases. Paint outside the face does not stick. */
export function dab(grid: Uint8Array, u: number, v: number, r: number, color: number) {
  const x0 = Math.max(0, Math.floor((u - r) * GRID));
  const x1 = Math.min(GRID - 1, Math.ceil((u + r) * GRID));
  const y0 = Math.max(0, Math.floor((v - r) * GRID));
  const y1 = Math.min(GRID - 1, Math.ceil((v + r) * GRID));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cu = cellCenter(x);
      const cv = cellCenter(y);
      if (Math.hypot(cu - u, cv - v) <= r && insideFace(cu, cv)) grid[y * GRID + x] = color;
    }
}

/** Brush along a drag: dabs close enough together to make a continuous line. */
export function stroke(grid: Uint8Array, from: P, to: P, r: number, color: number) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.ceil(d / (r * 0.5)));
  for (let i = 1; i <= n; i++) dab(grid, from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n, r, color);
}

/**
 * How close the painted face is to the request, 0..100. Right colour in the right place counts;
 * missing paint, paint where none was asked and the wrong colour all count against it.
 */
export function match(target: Uint8Array, painted: Uint8Array): number {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let wrong = 0;
  for (let i = 0; i < target.length; i++) {
    const t = target[i];
    const p = painted[i];
    if (t && p) {
      if (t === p) tp++;
      else wrong++;
    } else if (p) fp++;
    else if (t) fn++;
  }
  const denom = 2 * tp + fp + fn + 2 * wrong;
  return denom ? Math.round((200 * tp) / denom) : 0;
}

export const CUSTOMERS = 3;
export const TIME: Record<Difficulty, number> = { easy: 75, normal: 55, hard: 40 };
/** Brush sizes (radius in face units). */
export const BRUSHES = [
  { id: "s", r: 0.014, name: "نازک" },
  { id: "m", r: 0.026, name: "متوسط" },
  { id: "l", r: 0.045, name: "پهن" },
] as const;

const NAMES = ["سارا", "آرین", "نازنین", "کیان", "یاسمن", "امید", "ترانه", "پارسا"];
const SKINS = ["#f6cfb0", "#eab58f", "#d9a07a", "#f2c4a2", "#c98f68"];
const HAIRS = ["#2b1d14", "#5a3a22", "#151210", "#8a5a2b", "#3b2a1c"];

export interface Customer {
  design: Design;
  target: Uint8Array;
  name: string;
  skin: string;
  hair: string;
  girl: boolean;
}

export interface FaceResult {
  design: string;
  percent: number;
  secondsLeft: number;
  points: number;
}

export interface FacePaintState {
  difficulty: Difficulty;
  customers: Customer[];
  index: number;
  painted: Uint8Array;
  timeLeft: number;
  results: FaceResult[];
  /** colours used on any face this round */
  used: Set<number>;
  /** after a face is done: its result is shown for a moment before the next child sits down */
  showing: number;
  over: boolean;
}

/** `rand` is injectable for tests. */
export function createFacePaint(difficulty: Difficulty, rand: () => number = Math.random): FacePaintState {
  const pool = [...DESIGNS];
  const names = [...NAMES];
  const customers: Customer[] = [];
  for (let i = 0; i < CUSTOMERS; i++) {
    const design = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    const name = names.splice(Math.floor(rand() * names.length), 1)[0];
    customers.push({
      design,
      target: rasterize(design),
      name,
      skin: SKINS[Math.floor(rand() * SKINS.length)],
      hair: HAIRS[Math.floor(rand() * HAIRS.length)],
      girl: ["سارا", "نازنین", "یاسمن", "ترانه"].includes(name),
    });
  }
  return { difficulty, customers, index: 0, painted: new Uint8Array(GRID * GRID), timeLeft: TIME[difficulty], results: [], used: new Set(), showing: 0, over: false };
}

/** Points for one face: accuracy, plus a time bonus for a good result. */
export const facePoints = (percent: number, secondsLeft: number) => percent * 10 + (percent >= 60 ? Math.round(secondsLeft) * 3 : 0);

/** «تمام شد» (or the time ran out): score this face and show its result. */
export function finishFace(s: FacePaintState): FaceResult | null {
  if (s.over || s.showing > 0) return null;
  const c = s.customers[s.index];
  const percent = match(c.target, s.painted);
  for (const v of s.painted) if (v) s.used.add(v);
  const r: FaceResult = { design: c.design.id, percent, secondsLeft: Math.max(0, s.timeLeft), points: facePoints(percent, Math.max(0, s.timeLeft)) };
  s.results.push(r);
  s.showing = 2.2;
  return r;
}

/** Advance time; returns true when the round is over. */
export function stepFacePaint(s: FacePaintState, dt: number): boolean {
  if (s.over) return true;
  if (s.showing > 0) {
    s.showing -= dt;
    if (s.showing <= 0) {
      s.showing = 0;
      if (s.index + 1 >= s.customers.length) s.over = true;
      else {
        s.index++;
        s.painted = new Uint8Array(GRID * GRID);
        s.timeLeft = TIME[s.difficulty];
      }
    }
    return s.over;
  }
  s.timeLeft -= dt;
  if (s.timeLeft <= 0) {
    s.timeLeft = 0;
    finishFace(s);
  }
  return false;
}

export const totalScore = (s: FacePaintState) => s.results.reduce((a, r) => a + r.points, 0);

export function roundStats(s: FacePaintState) {
  const p = s.results.map((r) => r.percent);
  return {
    score: totalScore(s),
    faces: p.length,
    best: p.length ? Math.max(...p) : 0,
    worst: p.length ? Math.min(...p) : 0,
    avg: p.length ? Math.round(p.reduce((a, b) => a + b, 0) / p.length) : 0,
    colors: s.used.size,
    hard: s.difficulty === "hard",
  };
}

/** Reaction of the child to a result. */
export const reaction = (percent: number) => (percent >= 85 ? { emoji: "😍", text: "عالی شد!" } : percent >= 65 ? { emoji: "😊", text: "خیلی قشنگه!" } : percent >= 40 ? { emoji: "🙂", text: "بد نیست!" } : { emoji: "😕", text: "این که اون نشد…" });
