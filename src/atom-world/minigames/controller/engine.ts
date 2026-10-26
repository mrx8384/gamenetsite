/**
 * «چالش دستهٔ گیم‌نت»: a symbol (△ ○ ✕ □, later also the D-pad arrows) appears on the station's
 * TV; press the same button on the controller before its time runs out. Hits score more the faster
 * they are and the longer the streak; a wrong button or a timeout costs a life and the streak.
 * Pure logic (no DOM), unit-tested.
 */
import type { Difficulty } from "../types";

export type Btn = "triangle" | "circle" | "cross" | "square" | "up" | "down" | "left" | "right";
export const FACE: Btn[] = ["triangle", "circle", "cross", "square"];
export const DPAD: Btn[] = ["up", "right", "down", "left"];

export const DURATION = 45;

const LEVELS: Record<Difficulty, { slow: number; fast: number; lives: number; dpadAfter: number }> = {
  easy: { slow: 2.2, fast: 1.0, lives: 5, dpadAfter: Infinity },
  normal: { slow: 1.8, fast: 0.75, lives: 3, dpadAfter: 10 },
  hard: { slow: 1.4, fast: 0.55, lives: 3, dpadAfter: 0 },
};

export interface ControllerState {
  difficulty: Difficulty;
  left: number;
  score: number;
  combo: number;
  bestCombo: number;
  hits: number;
  misses: number;
  lives: number;
  prompt: Btn | null;
  /** Seconds since the prompt appeared, and how long it may stay. */
  age: number;
  window: number;
  /** Short pause between prompts. */
  gap: number;
  /** Last answer, for the flash on the TV. */
  last: { ok: boolean; btn: Btn; points: number; t: number } | null;
  /** Fastest correct answer (seconds). */
  fastest: number;
  over: boolean;
  rand: () => number;
}

export function createController(difficulty: Difficulty = "normal", rand: () => number = Math.random): ControllerState {
  return { difficulty, left: DURATION, score: 0, combo: 0, bestCombo: 0, hits: 0, misses: 0, lives: LEVELS[difficulty].lives, prompt: null, age: 0, window: LEVELS[difficulty].slow, gap: 0.4, last: null, fastest: Infinity, over: false, rand };
}

/** Time allowed for the next prompt: shrinks with every hit. */
export function windowFor(s: Pick<ControllerState, "difficulty" | "hits">) {
  const l = LEVELS[s.difficulty];
  return l.fast + (l.slow - l.fast) * Math.exp(-s.hits / 14);
}

/** Streak multiplier: ×1, then +0.5 every 5 hits in a row, up to ×3. */
export const multiplier = (combo: number) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

function nextPrompt(s: ControllerState) {
  const pool = s.hits >= LEVELS[s.difficulty].dpadAfter ? [...FACE, ...DPAD] : FACE;
  let b = pool[Math.floor(s.rand() * pool.length)];
  if (b === s.prompt) b = pool[(pool.indexOf(b) + 1) % pool.length]; // never the same twice in a row
  s.prompt = b;
  s.age = 0;
  s.window = windowFor(s);
}

function miss(s: ControllerState, btn: Btn) {
  s.misses++;
  s.combo = 0;
  s.lives--;
  s.last = { ok: false, btn, points: 0, t: 0 };
  s.prompt = null;
  s.gap = 0.6;
  if (s.lives <= 0) s.over = true;
}

/** A button press. */
export function press(s: ControllerState, btn: Btn): "hit" | "miss" | "ignored" {
  if (s.over || !s.prompt) return "ignored";
  if (btn !== s.prompt) {
    miss(s, btn);
    return "miss";
  }
  const speed = Math.max(0, 1 - s.age / s.window); // 1 = instant
  s.combo++;
  s.bestCombo = Math.max(s.bestCombo, s.combo);
  s.hits++;
  s.fastest = Math.min(s.fastest, s.age);
  const points = Math.round((10 + 10 * speed) * multiplier(s.combo));
  s.score += points;
  s.last = { ok: true, btn, points, t: 0 };
  s.prompt = null;
  s.gap = 0.25;
  return "hit";
}

export function step(s: ControllerState, dt: number) {
  if (s.over) return;
  s.left = Math.max(0, s.left - dt);
  if (s.last) s.last.t += dt;
  if (s.left <= 0) {
    s.over = true;
    s.prompt = null;
    return;
  }
  if (s.prompt) {
    s.age += dt;
    if (s.age >= s.window) miss(s, s.prompt);
  } else {
    s.gap -= dt;
    if (s.gap <= 0) nextPrompt(s);
  }
}
