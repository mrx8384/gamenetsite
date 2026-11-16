import type { Difficulty } from "../types";

/**
 * «فوتبال نشسته» on the FOOTBALLS table (upper floor): two players sit facing each other at the ends
 * of a caged lane and kick the ball with a foot towards the other end's goal. First to GOALS wins.
 * Pure and deterministic with an injected `rand`, so tests can play it.
 *
 * Units ≈ metres. x across the lane (−HALF_W..HALF_W), y along it: the player sits at y = +HALF_L
 * (bottom of the screen), the computer at y = −HALF_L. The lane is slightly domed, so a ball that
 * stops in the middle rolls back towards the nearer player (nobody gets up from their seat).
 */
export const HALF_W = 0.475;
export const HALF_L = 0.875;
export const GOAL_HALF = 0.21;
export const BALL_R = 0.05;
export const FOOT_R = 0.085;
/** Resting line of a foot (distance from the centre), how far a kick reaches, how long it takes. */
export const FOOT_Y = 0.7;
export const KICK_REACH = 0.2;
export const KICK_TIME = 0.26;
export const FOOT_MAX_X = HALF_W - FOOT_R;
export const GOALS = 5;
const SERVE_PAUSE = 1.1;
const MAX_BALL = 3.0;

/** Computer: how fast its foot slides, how far off it aims, how often it kicks in time. */
export const AI = {
  easy: { speed: 0.9, error: 0.1, kick: 0.5, react: 0.25, aim: 0.012 },
  normal: { speed: 1.4, error: 0.05, kick: 0.75, react: 0.15, aim: 0.028 },
  hard: { speed: 2.0, error: 0.02, kick: 0.93, react: 0.08, aim: 0.04 },
} as const;

export interface Foot {
  x: number;
  /** current distance from the centre line along y (FOOT_Y at rest, less while kicking) */
  y: number;
  vx: number;
  /** seconds since the kick started; ≥ KICK_TIME = at rest */
  kickT: number;
}

export interface SeatedInput {
  /** where the player's foot should go (lane x) */
  x: number;
  kick: boolean;
}

export interface SeatedState {
  difficulty: Difficulty;
  time: number;
  /** playing time only (without the pauses) */
  elapsed: number;
  ball: { x: number; y: number; vx: number; vy: number };
  /** the player's foot (bottom) and the computer's (top) */
  me: Foot;
  ai: Foot;
  aiTarget: number;
  aiThink: number;
  /** hits since the last serve: every hit makes the ball a little faster, so rallies end */
  rally: number;
  /** the computer already decided about the ball now in its reach */
  aiChance: boolean;
  score: { player: number; ai: number };
  /** freeze before a serve */
  pause: number;
  over: boolean;
  kicks: number;
  note: { text: string; t: number } | null;
  events: { goals: number; hits: number; bounces: number };
  rand: () => number;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fa = (n: number) => n.toLocaleString("fa-IR");

export function createSeated(difficulty: Difficulty = "normal", rand: () => number = Math.random): SeatedState {
  const s: SeatedState = {
    difficulty,
    time: 0,
    elapsed: 0,
    ball: { x: 0, y: 0, vx: 0, vy: 0 },
    me: { x: 0, y: FOOT_Y, vx: 0, kickT: KICK_TIME },
    ai: { x: 0, y: FOOT_Y, vx: 0, kickT: KICK_TIME },
    aiTarget: 0,
    aiThink: 0,
    aiChance: false,
    rally: 0,
    score: { player: 0, ai: 0 },
    pause: SERVE_PAUSE,
    over: false,
    kicks: 0,
    note: { text: "با پا توپ را به دروازهٔ روبه‌رو بزنید! ⚽", t: 0 },
    events: { goals: 0, hits: 0, bounces: 0 },
    rand,
  };
  serve(s, 1);
  return s;
}

/** The ball starts in the middle and rolls towards `to` (1 = the player, −1 = the computer). */
function serve(s: SeatedState, to: 1 | -1) {
  s.ball = { x: (s.rand() - 0.5) * 0.3, y: 0, vx: (s.rand() - 0.5) * 0.5, vy: 0.75 * to };
  s.pause = SERVE_PAUSE;
  s.rally = 0;
}

/** Where a foot is along y right now (a kick goes out fast and comes back slower). */
function footReach(kickT: number) {
  if (kickT >= KICK_TIME) return 0;
  const u = kickT / KICK_TIME;
  return KICK_REACH * (u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65);
}

/** Speed of the foot along its kick (towards the centre is positive). */
function footKickSpeed(kickT: number) {
  if (kickT >= KICK_TIME) return 0;
  const u = kickT / KICK_TIME;
  return u < 0.35 ? KICK_REACH / (0.35 * KICK_TIME) : -KICK_REACH / (0.65 * KICK_TIME);
}

function moveFoot(f: Foot, targetX: number, maxSpeed: number, dt: number) {
  const x0 = f.x;
  const dx = clamp(targetX, -FOOT_MAX_X, FOOT_MAX_X) - f.x;
  f.x += clamp(dx, -maxSpeed * dt, maxSpeed * dt);
  f.vx = dt > 0 ? (f.x - x0) / dt : 0;
  f.kickT = Math.min(KICK_TIME, f.kickT + dt);
  f.y = FOOT_Y - footReach(f.kickT);
}

/** Ball against a foot (`side` 1 = the player's end, −1 = the computer's). */
function hitFoot(s: SeatedState, f: Foot, side: 1 | -1) {
  const b = s.ball;
  const fy = f.y * side;
  const dx = b.x - f.x;
  const dy = b.y - fy;
  const d = Math.hypot(dx, dy);
  const min = BALL_R + FOOT_R;
  if (d >= min || d === 0) return;
  // a ball that got past the foot is missed: it rolls on behind it (never pinned in a corner)
  if (dy * side > FOOT_R * 0.5) return;
  const nx = dx / d;
  const ny = dy / d;
  // out of the foot, then bounce off it in the foot's own moving frame
  b.x = f.x + nx * min;
  b.y = fy + ny * min;
  const fvx = f.vx;
  const fvy = -side * footKickSpeed(f.kickT);
  const rel = (b.vx - fvx) * nx + (b.vy - fvy) * ny;
  const heat = 1 + Math.min(1.2, s.rally * 0.07);
  if (rel < 0) {
    b.vx -= 1.75 * rel * nx * heat;
    b.vy -= 1.75 * rel * ny * heat;
    s.events.hits++;
    s.rally++;
  }
  // a ball in front of the foot always leaves it towards the other end
  if (ny * side < 0 && b.vy * side > -0.35) b.vy = -0.35 * side;
  const sp = Math.hypot(b.vx, b.vy);
  const max = MAX_BALL * heat;
  if (sp > max) {
    b.vx *= max / sp;
    b.vy *= max / sp;
  }
}

function think(s: SeatedState, dt: number) {
  const ai = AI[s.difficulty];
  const b = s.ball;
  const footY = -s.ai.y;
  const ahead = b.y - footY; // distance in front of the foot (towards the centre)
  s.aiThink -= dt;
  if (s.aiThink <= 0) {
    s.aiThink = ai.react;
    if (ahead > 0 && (b.vy < 0 || b.y < 0)) {
      // where the ball will reach the foot line (walls ignored), a little to one side so the
      // kick angles away from the player's foot
      const t = b.vy < -0.05 ? Math.min(1.2, ahead / -b.vy) : 0;
      const away = Math.sign(b.x - s.me.x) || 1;
      s.aiTarget = clamp(b.x + b.vx * t, -FOOT_MAX_X, FOOT_MAX_X) - away * ai.aim + (s.rand() - 0.5) * 2 * ai.error;
    } else s.aiTarget = b.x * 0.3; // the ball is away or already past: guard the middle
  }
  // one decision per chance: kick when the ball comes within reach in front of the foot
  const inReach = ahead > 0 && ahead < KICK_REACH + BALL_R + FOOT_R * 0.6 && Math.abs(b.x - s.ai.x) < FOOT_R + BALL_R;
  if (!inReach) s.aiChance = false;
  else if (!s.aiChance) {
    s.aiChance = true;
    if (s.ai.kickT >= KICK_TIME && s.rand() < ai.kick) s.ai.kickT = 0;
  }
  moveFoot(s.ai, s.aiTarget, ai.speed, dt);
}

export function stepSeated(s: SeatedState, dt: number, input: SeatedInput) {
  if (s.over) return;
  s.time += dt;
  // feet move during the pauses too
  if (input.kick && s.me.kickT >= KICK_TIME) {
    s.me.kickT = 0;
    s.kicks++;
  }
  moveFoot(s.me, input.x, 2.6, dt);
  if (s.pause > 0) {
    s.pause -= dt;
    moveFoot(s.ai, 0, AI[s.difficulty].speed, dt);
    return;
  }
  s.elapsed += dt;
  think(s, dt);

  const b = s.ball;
  // the lane is slightly domed: the ball rolls towards the nearer end
  b.vy += (b.y >= 0 ? 1 : -1) * 0.55 * dt;
  // behind the feet the floor funnels into the goal mouth: a ball you miss ends up in your goal
  if (Math.abs(b.y) > FOOT_Y + FOOT_R) b.vx -= Math.sign(b.x) * 1.4 * dt;
  const f = Math.exp(-0.35 * dt);
  b.vx *= f;
  b.vy *= f;
  // small steps so a fast ball cannot pass through a foot
  const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 0.02));
  for (let i = 0; i < steps; i++) {
    b.x += (b.vx * dt) / steps;
    b.y += (b.vy * dt) / steps;
    if (Math.abs(b.x) > HALF_W - BALL_R) {
      b.x = clamp(b.x, -(HALF_W - BALL_R), HALF_W - BALL_R);
      b.vx *= -0.85;
      s.events.bounces++;
    }
    hitFoot(s, s.me, 1);
    hitFoot(s, s.ai, -1);
    // a foot never pushes the ball out through the cage
    b.x = clamp(b.x, -(HALF_W - BALL_R), HALF_W - BALL_R);
    if (Math.abs(b.y) > HALF_L - BALL_R) {
      if (Math.abs(b.x) < GOAL_HALF) {
        // through a goal mouth
        const mine = b.y < 0;
        if (mine) s.score.player++;
        else s.score.ai++;
        s.events.goals++;
        s.note = { text: mine ? `گُل! ${fa(s.score.player)} – ${fa(s.score.ai)} 🎉` : `گل خوردید! ${fa(s.score.player)} – ${fa(s.score.ai)}`, t: s.time };
        if (s.score.player >= GOALS || s.score.ai >= GOALS) {
          s.over = true;
          return;
        }
        serve(s, mine ? -1 : 1);
        return;
      }
      b.y = clamp(b.y, -(HALF_L - BALL_R), HALF_L - BALL_R);
      b.vy *= -0.8;
      s.events.bounces++;
    }
  }
}

export function seatedResult(s: SeatedState) {
  const won = s.score.player > s.score.ai;
  return { won, goals: s.score.player, against: s.score.ai, points: Math.max(0, s.score.player * 100 - s.score.ai * 40 + (won ? 250 : 0) + (won ? Math.max(0, 120 - Math.round(s.elapsed)) : 0)) };
}
