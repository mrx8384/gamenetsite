/**
 * Air-hockey physics and computer opponent (no rendering).
 * Table space: x across (-W/2..W/2), y along (-L/2 = computer's goal, +L/2 = player's goal), metres-ish.
 * Proportions follow a standard arcade table (about 1 : 1.9); the club's tables are this type.
 */
export const TABLE = { W: 1, L: 1.9, goal: 0.36, puckR: 0.04, malletR: 0.068 } as const;
export const WIN_SCORE = 5;

export type Difficulty = "easy" | "normal" | "hard";
const AI = {
  easy: { speed: 1.5, reaction: 0.22, aim: 0.25 },
  normal: { speed: 2.3, reaction: 0.12, aim: 0.12 },
  hard: { speed: 3.2, reaction: 0.06, aim: 0.05 },
} as const;

const MAX_PUCK = 5;
const MAX_MALLET = 7;
const WALL_E = 0.9;
const HIT_E = 0.92;
const FRICTION = 0.22; // per second (air table: very little)

export interface Vec {
  x: number;
  y: number;
}
export interface Body extends Vec {
  vx: number;
  vy: number;
}

export type HockeyEvent = { type: "wall"; v: number } | { type: "hit"; v: number; by: "player" | "ai" } | { type: "goal"; scorer: "player" | "ai" };

export interface HockeyState {
  puck: Body;
  player: Body;
  ai: Body;
  /** Where the player wants the mallet (pointer / keys). */
  target: Vec;
  /** Two players on one device: the top mallet follows `target2` instead of the computer. */
  twoPlayer: boolean;
  target2: Vec;
  aiTarget: Vec;
  aiThink: number;
  score: { player: number; ai: number };
  /** Seconds until play resumes after a goal. */
  pause: number;
  /** Who serves after the pause (puck placed in that half). */
  serve: "player" | "ai";
  slowTime: number;
  elapsed: number;
  over: boolean;
  difficulty: Difficulty;
}

export function createHockey(difficulty: Difficulty = "normal", twoPlayer = false): HockeyState {
  const s: HockeyState = {
    puck: { x: 0, y: 0, vx: 0, vy: 0 },
    player: { x: 0, y: TABLE.L / 2 - 0.2, vx: 0, vy: 0 },
    ai: { x: 0, y: -TABLE.L / 2 + 0.2, vx: 0, vy: 0 },
    target: { x: 0, y: TABLE.L / 2 - 0.2 },
    twoPlayer,
    target2: { x: 0, y: -TABLE.L / 2 + 0.2 },
    aiTarget: { x: 0, y: -TABLE.L / 2 + 0.2 },
    aiThink: 0,
    score: { player: 0, ai: 0 },
    pause: 1,
    serve: "player",
    slowTime: 0,
    elapsed: 0,
    over: false,
    difficulty,
  };
  placePuck(s);
  return s;
}

function placePuck(s: HockeyState) {
  s.puck.x = 0;
  s.puck.y = s.serve === "player" ? TABLE.L / 4 - 0.1 : -TABLE.L / 4 + 0.1;
  s.puck.vx = 0;
  s.puck.vy = 0;
  s.slowTime = 0;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Keeps a mallet on its own half and inside the rails. */
function clampMallet(p: Vec, side: "player" | "ai") {
  const r = TABLE.malletR;
  p.x = clamp(p.x, -TABLE.W / 2 + r, TABLE.W / 2 - r);
  if (side === "player") p.y = clamp(p.y, r * 0.5, TABLE.L / 2 - r);
  else p.y = clamp(p.y, -TABLE.L / 2 + r, -r * 0.5);
}

function moveMallet(m: Body, target: Vec, maxSpeed: number, dt: number, side: "player" | "ai") {
  const t = { x: target.x, y: target.y };
  clampMallet(t, side);
  const dx = t.x - m.x;
  const dy = t.y - m.y;
  const d = Math.hypot(dx, dy);
  const step = Math.min(d, maxSpeed * dt);
  const nx = d > 1e-6 ? m.x + (dx / d) * step : m.x;
  const ny = d > 1e-6 ? m.y + (dy / d) * step : m.y;
  m.vx = (nx - m.x) / dt;
  m.vy = (ny - m.y) / dt;
  m.x = nx;
  m.y = ny;
}

/** Mallet (infinite mass) against puck. */
function collide(s: HockeyState, m: Body, by: "player" | "ai", events: HockeyEvent[]) {
  const p = s.puck;
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  const minD = TABLE.puckR + TABLE.malletR;
  const d = Math.hypot(dx, dy);
  if (d >= minD) return;
  const nx = d > 1e-6 ? dx / d : 0;
  const ny = d > 1e-6 ? dy / d : by === "player" ? -1 : 1;
  p.x = m.x + nx * minD;
  p.y = m.y + ny * minD;
  const rvx = p.vx - m.vx;
  const rvy = p.vy - m.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    p.vx -= (1 + HIT_E) * vn * nx;
    p.vy -= (1 + HIT_E) * vn * ny;
    events.push({ type: "hit", v: -vn, by });
  }
  limit(p, MAX_PUCK);
}

function limit(b: Body, max: number) {
  const v = Math.hypot(b.vx, b.vy);
  if (v > max) {
    b.vx *= max / v;
    b.vy *= max / v;
  }
}

/** Computer opponent: defends its goal line, strikes when the puck is in its half. */
function think(s: HockeyState, dt: number) {
  const cfg = AI[s.difficulty];
  s.aiThink -= dt;
  if (s.aiThink > 0) return;
  s.aiThink = cfg.reaction;
  const p = s.puck;
  const home = { x: 0, y: -TABLE.L / 2 + 0.16 };
  const inMyHalf = p.y < 0;
  const coming = p.vy < -0.05;
  const jitter = (Math.random() - 0.5) * cfg.aim;
  if (inMyHalf && (Math.abs(p.vy) < 1.2 || !coming)) {
    // attack: from the goal side of the puck, drive through it towards the player's goal
    const aimX = clamp(-p.x * 0.6 + jitter, -TABLE.goal / 2, TABLE.goal / 2);
    const dirX = aimX - p.x;
    const dirY = TABLE.L / 2 - p.y;
    const dl = Math.hypot(dirX, dirY) || 1;
    if (s.ai.y > p.y - 0.02) {
      // mallet is in front of the puck: go around it first
      const side = s.ai.x >= p.x ? 1 : -1;
      s.aiTarget = { x: p.x + side * (TABLE.malletR + TABLE.puckR + 0.03), y: p.y - 0.14 };
    } else {
      s.aiTarget = { x: p.x + (dirX / dl) * 0.14, y: p.y + (dirY / dl) * 0.14 };
    }
  } else {
    // defend: stay between the puck and the goal centre
    const lead = coming ? clamp(p.x + p.vx * Math.min(0.4, Math.abs((p.y - home.y) / (p.vy || -1))), -TABLE.W / 2, TABLE.W / 2) : p.x;
    s.aiTarget = { x: clamp(lead * 0.55 + jitter, -TABLE.goal * 0.7, TABLE.goal * 0.7), y: home.y };
  }
}

/** Advances the match. Returns what happened this step (for sounds). */
export function stepHockey(s: HockeyState, dtIn: number): HockeyEvent[] {
  const events: HockeyEvent[] = [];
  if (s.over) return events;
  const dtAll = Math.min(dtIn, 0.05);
  s.elapsed += dtAll;
  const steps = Math.max(1, Math.ceil(dtAll / (1 / 240)));
  const dt = dtAll / steps;
  for (let i = 0; i < steps; i++) {
    moveMallet(s.player, s.target, MAX_MALLET, dt, "player");
    if (s.twoPlayer) moveMallet(s.ai, s.target2, MAX_MALLET, dt, "ai");
    else {
      think(s, dt);
      moveMallet(s.ai, s.aiTarget, AI[s.difficulty].speed, dt, "ai");
    }
    if (s.pause > 0) {
      s.pause -= dt;
      continue;
    }
    const p = s.puck;
    const f = Math.exp(-FRICTION * dt);
    p.vx *= f;
    p.vy *= f;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const r = TABLE.puckR;
    // side rails
    if (p.x < -TABLE.W / 2 + r) {
      p.x = -TABLE.W / 2 + r;
      if (p.vx < 0) {
        events.push({ type: "wall", v: -p.vx });
        p.vx = -p.vx * WALL_E;
      }
    } else if (p.x > TABLE.W / 2 - r) {
      p.x = TABLE.W / 2 - r;
      if (p.vx > 0) {
        events.push({ type: "wall", v: p.vx });
        p.vx = -p.vx * WALL_E;
      }
    }
    // end rails, with the goal mouths
    const inMouth = Math.abs(p.x) < TABLE.goal / 2 - r * 0.3;
    if (p.y > TABLE.L / 2 + r && inMouth) {
      goal(s, "ai", events);
      break;
    }
    if (p.y < -TABLE.L / 2 - r && inMouth) {
      goal(s, "player", events);
      break;
    }
    if (!inMouth) {
      if (p.y > TABLE.L / 2 - r) {
        p.y = TABLE.L / 2 - r;
        if (p.vy > 0) {
          events.push({ type: "wall", v: p.vy });
          p.vy = -p.vy * WALL_E;
        }
      } else if (p.y < -TABLE.L / 2 + r) {
        p.y = -TABLE.L / 2 + r;
        if (p.vy < 0) {
          events.push({ type: "wall", v: -p.vy });
          p.vy = -p.vy * WALL_E;
        }
      }
    }
    collide(s, s.player, "player", events);
    collide(s, s.ai, "ai", events);
    // a puck left resting in one half for too long goes to the other side (keeps the game moving)
    s.slowTime = Math.hypot(p.vx, p.vy) < 0.03 ? s.slowTime + dt : 0;
    if (s.slowTime > 6) {
      s.serve = p.y > 0 ? "ai" : "player";
      placePuck(s);
    }
  }
  return events;
}

function goal(s: HockeyState, scorer: "player" | "ai", events: HockeyEvent[]) {
  s.score[scorer]++;
  events.push({ type: "goal", scorer });
  s.serve = scorer === "player" ? "ai" : "player";
  placePuck(s);
  s.pause = 1.2;
  if (s.score[scorer] >= WIN_SCORE) s.over = true;
}
