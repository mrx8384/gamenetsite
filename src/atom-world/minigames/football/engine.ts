import type { Difficulty } from "../types";

/**
 * «فوتبال اتم»: a top-down 3-on-3 futsal match against the computer (a keeper and two field
 * players a side, boards all round, no throw-ins). Pure and deterministic with an injected `rand`,
 * so tests can play it. World units ≈ metres, y grows downwards (canvas), team 0 (green, the player)
 * attacks the goal at x = L.
 */
export const L = 60; // pitch length
export const W = 36; // pitch width
export const GOAL = 4.2; // half the goal mouth
export const PR = 0.9; // player radius
export const BR = 0.45; // ball radius
export const MATCH = { easy: 120, normal: 120, hard: 120 } as const;
export const SPEED = 7.5;
export const SHOT = 24;
/** Computer strength: running speed, keeper saves, tackles, shot accuracy. */
export const AI = {
  easy: { speed: 0.8, save: 0.55, tackle: 0.32, aim: 2.4 },
  normal: { speed: 0.9, save: 0.66, tackle: 0.45, aim: 1.7 },
  hard: { speed: 0.98, save: 0.74, tackle: 0.55, aim: 1.2 },
} as const;
const OUR_SAVE = 0.68;
const USER_TACKLE = 0.6;
const KICKOFF_PAUSE = 1.6;

export interface Player {
  id: number;
  team: 0 | 1;
  role: "gk" | "field";
  num: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: number;
  /** can't take the ball back straight after kicking or losing it */
  kickCd: number;
  tackleCd: number;
  /** dash (user's «تکل») */
  dash: number;
  think: number;
  goal: { x: number; y: number };
  hold: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number | null;
  /** id of the last kick: a keeper gets one save roll per shot */
  kick: number;
  lastTeam: 0 | 1 | null;
}

export interface FootballInput {
  x: number;
  y: number;
  shoot: boolean;
  pass: boolean;
}

export interface FootballState {
  difficulty: Difficulty;
  time: number;
  left: number;
  players: Player[];
  ball: Ball;
  score: [number, number];
  controlled: number;
  /** freeze after a goal / at kick-off */
  pause: number;
  over: boolean;
  shots: number;
  tackles: number;
  rolled: Set<string>;
  note: { text: string; t: number } | null;
  events: { goals: number; kicks: number; bounces: number };
  rand: () => number;
}

const CY = W / 2;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const faDigits = (n: number) => n.toLocaleString("fa-IR");

/** Where each player lines up at kick-off. */
function kickoffSpots(team: 0 | 1): { x: number; y: number }[] {
  const s = team === 0 ? 1 : -1;
  const own = team === 0 ? 0 : L;
  return [
    { x: own + s * 2, y: CY },
    { x: L / 2 - s * 6, y: CY - 7 },
    { x: L / 2 - s * 6, y: CY + 7 },
  ];
}

export function createFootball(difficulty: Difficulty = "normal", rand: () => number = Math.random): FootballState {
  const players: Player[] = [];
  let id = 0;
  for (const team of [0, 1] as const)
    kickoffSpots(team).forEach((p, k) =>
      players.push({ id: id++, team, role: k === 0 ? "gk" : "field", num: k === 0 ? 1 : k === 1 ? 7 : 10, ...p, vx: 0, vy: 0, face: team === 0 ? 0 : Math.PI, kickCd: 0, tackleCd: 0, dash: 0, think: 0, goal: { ...p }, hold: 0 }),
    );
  const s: FootballState = {
    difficulty,
    time: 0,
    left: MATCH[difficulty],
    players,
    ball: { x: L / 2, y: CY, vx: 0, vy: 0, owner: null, kick: 0, lastTeam: null },
    score: [0, 0],
    controlled: 2,
    pause: KICKOFF_PAUSE,
    over: false,
    shots: 0,
    tackles: 0,
    rolled: new Set(),
    note: null,
    events: { goals: 0, kicks: 0, bounces: 0 },
    rand,
  };
  kickoff(s, 0);
  s.note = { text: "شروع بازی! به سمت دروازهٔ راست حمله کنید ⚽", t: 0 };
  return s;
}

/** Everyone back to their spots; `team` takes the kick-off. */
function kickoff(s: FootballState, team: 0 | 1) {
  for (const p of s.players) {
    const spot = kickoffSpots(p.team)[p.role === "gk" ? 0 : p.num === 7 ? 1 : 2];
    Object.assign(p, { x: spot.x, y: spot.y, vx: 0, vy: 0, face: p.team === 0 ? 0 : Math.PI, kickCd: 0, tackleCd: 0, dash: 0, hold: 0 });
  }
  const taker = s.players.find((p) => p.team === team && p.num === 10)!;
  taker.x = L / 2 + (team === 0 ? -1.6 : 1.6);
  taker.y = CY;
  Object.assign(s.ball, { x: L / 2, y: CY, vx: 0, vy: 0, owner: taker.id, lastTeam: team });
  if (team === 0) s.controlled = taker.id;
  s.pause = KICKOFF_PAUSE;
}

const owner = (s: FootballState) => (s.ball.owner === null ? null : s.players[s.ball.owner]);
const teamOf = (s: FootballState, t: 0 | 1) => s.players.filter((p) => p.team === t);
const fieldOf = (s: FootballState, t: 0 | 1) => s.players.filter((p) => p.team === t && p.role === "field");
const attackX = (t: 0 | 1) => (t === 0 ? L : 0);

/** Kick the ball from its owner towards (tx, ty) at `speed`. */
function kick(s: FootballState, p: Player, tx: number, ty: number, speed: number) {
  const a = Math.atan2(ty - s.ball.y, tx - s.ball.x);
  s.ball.owner = null;
  s.ball.vx = Math.cos(a) * speed;
  s.ball.vy = Math.sin(a) * speed;
  s.ball.kick++;
  s.ball.lastTeam = p.team;
  p.kickCd = 0.35;
  p.face = a;
  s.events.kicks++;
}

function shoot(s: FootballState, p: Player, aimNoise: number) {
  const gx = attackX(p.team);
  // aim inside the goal mouth: where the player faces, pulled into the goal
  const ahead = Math.cos(p.face) * (p.team === 0 ? 1 : -1) > 0.2;
  let ty: number;
  if (ahead) {
    const proj = s.ball.y + Math.tan(p.face) * (gx - s.ball.x);
    ty = clamp(Number.isFinite(proj) ? proj : CY, CY - GOAL + 0.6, CY + GOAL - 0.6);
  } else {
    // not facing the goal: a hard kick where the player faces
    kick(s, p, s.ball.x + Math.cos(p.face) * 10, s.ball.y + Math.sin(p.face) * 10, SHOT);
    if (p.team === 0) s.shots++;
    return;
  }
  ty += (s.rand() - 0.5) * 2 * aimNoise;
  kick(s, p, gx, ty, SHOT);
  if (p.team === 0) s.shots++;
}

/** Pass to the teammate best placed in front of the player (or the nearest one). */
function pass(s: FootballState, p: Player) {
  const mates = teamOf(s, p.team).filter((m) => m.id !== p.id && m.role === "field");
  const all = mates.length ? mates : teamOf(s, p.team).filter((m) => m.id !== p.id);
  let best = all[0];
  let bestScore = -Infinity;
  for (const m of all) {
    const a = Math.atan2(m.y - p.y, m.x - p.x);
    const cone = Math.cos(a - p.face);
    const d = dist(m, p);
    const sc = cone * 2 - d * 0.03;
    if (sc > bestScore) {
      bestScore = sc;
      best = m;
    }
  }
  const tx = best.x + best.vx * 0.35;
  const ty = best.y + best.vy * 0.35;
  const d = Math.hypot(tx - s.ball.x, ty - s.ball.y);
  kick(s, p, tx, ty, clamp(d * 1.4 + 8, 11, 21));
  if (p.team === 0) s.controlled = best.role === "field" ? best.id : s.controlled;
  return best;
}

function moveToward(p: Player, tx: number, ty: number, speed: number, dt: number) {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const want = d < 0.3 ? 0 : Math.min(speed, d * 3);
  const vx = d > 0 ? (dx / d) * want : 0;
  const vy = d > 0 ? (dy / d) * want : 0;
  steer(p, vx, vy, dt);
}

function steer(p: Player, vx: number, vy: number, dt: number) {
  const k = Math.min(1, dt * 10);
  p.vx += (vx - p.vx) * k;
  p.vy += (vy - p.vy) * k;
}

/** Computer-controlled players (both teams, except the one the user steers). */
function think(s: FootballState, p: Player, dt: number) {
  const ai = AI[s.difficulty];
  const own = owner(s);
  const b = s.ball;
  const speed = SPEED * (p.team === 1 ? ai.speed : 0.92);
  const s1 = p.team === 0 ? 1 : -1; // attacking direction
  const ownGoalX = p.team === 0 ? 0 : L;

  if (p.role === "gk") {
    const lineX = ownGoalX + s1 * 1.6;
    if (own === p) {
      // hold briefly, then throw it to the most open field player
      p.hold += dt;
      moveToward(p, lineX + s1 * 1.5, CY, speed * 0.5, dt);
      if (p.hold > 0.7) {
        const mates = fieldOf(s, p.team);
        const opp = fieldOf(s, p.team === 0 ? 1 : 0);
        const open = mates.reduce((a, m) => (Math.min(...opp.map((o) => dist(o, m))) > Math.min(...opp.map((o) => dist(o, a))) ? m : a), mates[0]);
        p.face = Math.atan2(open.y - p.y, open.x - p.x);
        pass(s, p);
        if (p.team === 0) s.controlled = open.id;
        p.hold = 0;
      }
      return;
    }
    // follow the ball across the goal mouth; come out a little when it is close
    const near = Math.abs(b.x - ownGoalX) < 10;
    const tx = near ? ownGoalX + s1 * clamp(Math.abs(b.x - ownGoalX) * 0.35, 1.2, 3.2) : lineX;
    const ty = clamp(b.y, CY - GOAL - 0.4, CY + GOAL + 0.4);
    moveToward(p, tx, ty, speed * 0.85, dt);
    return;
  }

  p.think -= dt;
  const mates = fieldOf(s, p.team);
  const other = mates.find((m) => m.id !== p.id)!;
  const foes = fieldOf(s, p.team === 0 ? 1 : 0);

  if (own === p) {
    // carrying the ball (computer side): run at goal, dodge the defender, pass or shoot
    const gx = attackX(p.team);
    const toGoal = Math.abs(gx - p.x);
    const block = foes.find((f) => dist(f, p) < 4.5 && (f.x - p.x) * s1 > 0);
    let ty = CY + (p.y - CY) * 0.6;
    if (block) ty = p.y + (p.y > block.y ? 6 : -6);
    moveToward(p, p.x + s1 * 8, clamp(ty, 2, W - 2), speed * 0.88, dt);
    if (p.think <= 0) {
      p.think = 0.3;
      const pressed = foes.some((f) => dist(f, p) < 2.6);
      if (toGoal < 15 && s.rand() < 0.4) {
        p.face = Math.atan2(CY - p.y, gx - p.x);
        shoot(s, p, ai.aim);
      } else if (pressed && other && (other.x - p.x) * s1 > -3 && s.rand() < 0.45) {
        p.face = Math.atan2(other.y - p.y, other.x - p.x);
        pass(s, p);
      }
    }
    return;
  }

  const ourBall = own !== null && own.team === p.team;
  if (ourBall) {
    // support run: ahead of the carrier, on the other side of the pitch
    const tx = clamp(own.x + s1 * 7, 4, L - 4);
    const ty = own.y > CY ? CY - 7 : CY + 7;
    moveToward(p, tx, ty, speed * 0.85, dt);
    return;
  }

  // defending or loose ball: the one nearer the ball presses, the other covers
  const chaser = mates.reduce((a, m) => (dist(m, b) < dist(a, b) ? m : a), mates[0]);
  const presses = p.team === 1 ? chaser === p : chaser === p && !mates.some((m) => m.id === s.controlled);
  if (presses || dist(p, b) < 3) {
    const lead = own ? 0.25 : 0.15;
    moveToward(p, b.x + b.vx * lead, b.y + b.vy * lead, speed, dt);
  } else {
    // stand between the ball and our goal
    const tx = (b.x + ownGoalX * 1.2) / 2.2 + s1 * 2;
    const ty = CY + (b.y - CY) * 0.6;
    moveToward(p, clamp(tx, 3, L - 3), ty, speed * 0.8, dt);
  }
}

export function stepFootball(s: FootballState, dt: number, input: FootballInput) {
  if (s.over) return;
  s.time += dt;
  if (s.pause > 0) {
    s.pause -= dt;
    for (const p of s.players) p.vx = p.vy = 0;
    return;
  }
  s.left -= dt;
  if (s.left <= 0) {
    s.left = 0;
    s.over = true;
    return;
  }
  const b = s.ball;

  // who the user steers: whoever on our side has the ball, else the field player nearest it
  const own = owner(s);
  if (own && own.team === 0 && own.role === "field") s.controlled = own.id;
  else if (!own || own.team === 1) {
    const cur = s.players[s.controlled];
    const alt = fieldOf(s, 0).find((p) => p.id !== s.controlled)!;
    if (dist(alt, b) + 3 < dist(cur, b)) s.controlled = alt.id;
  }
  const me = s.players[s.controlled];

  for (const p of s.players) {
    p.kickCd = Math.max(0, p.kickCd - dt);
    p.tackleCd = Math.max(0, p.tackleCd - dt);
    p.dash = Math.max(0, p.dash - dt);
  }

  // the user's player
  {
    const len = Math.hypot(input.x, input.y);
    const ix = len > 1 ? input.x / len : input.x;
    const iy = len > 1 ? -input.y / len : -input.y;
    const hasBall = b.owner === me.id;
    const sp = SPEED * (hasBall ? 0.88 : 1) * (me.dash > 0 ? 1.7 : 1);
    steer(me, ix * sp, iy * sp, dt);
    if (hasBall && input.shoot) shoot(s, me, 0.6);
    else if (hasBall && input.pass) pass(s, me);
    else if (!hasBall && input.shoot && me.dash <= 0) {
      // «تکل»: a short dash at the ball
      me.dash = 0.35;
      const a = Math.atan2(b.y - me.y, b.x - me.x);
      if (len < 0.2) me.face = a;
    } else if (!hasBall && input.pass) {
      // switch to the other field player
      s.controlled = fieldOf(s, 0).find((p) => p.id !== me.id)!.id;
    }
  }
  for (const p of s.players) if (p.id !== me.id) think(s, p, dt);

  // move players, face where they run, stay on the pitch, don't overlap
  for (const p of s.players) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (Math.hypot(p.vx, p.vy) > 0.6) p.face = Math.atan2(p.vy, p.vx);
    p.x = clamp(p.x, PR, L - PR);
    p.y = clamp(p.y, PR, W - PR);
  }
  for (let i = 0; i < s.players.length; i++)
    for (let j = i + 1; j < s.players.length; j++) {
      const a = s.players[i];
      const c = s.players[j];
      const d = dist(a, c);
      if (d > 0 && d < PR * 2) {
        const push = (PR * 2 - d) / 2;
        const nx = (c.x - a.x) / d;
        const ny = (c.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        c.x += nx * push;
        c.y += ny * push;
      }
    }

  // tackles: a player from the other side touching the carrier may win the ball
  const carrier = owner(s);
  if (carrier) {
    for (const p of s.players) {
      if (p.team === carrier.team || p.tackleCd > 0 || dist(p, carrier) > PR * 2 + 0.35) continue;
      p.tackleCd = 0.7;
      const chance = p.team === 0 ? USER_TACKLE + (p.dash > 0 ? 0.25 : 0) : AI[s.difficulty].tackle * (carrier.role === "gk" ? 0.3 : 1);
      if (s.rand() < chance) {
        b.owner = p.id;
        b.lastTeam = p.team;
        carrier.kickCd = 0.6;
        carrier.tackleCd = 0.6;
        s.tackles += p.team === 0 ? 1 : 0;
        if (p.team === 0 && p.role === "field") s.controlled = p.id;
        break;
      }
    }
  }

  // the ball
  const holder = owner(s);
  if (holder) {
    b.x = holder.x + Math.cos(holder.face) * (PR + BR + 0.05);
    b.y = holder.y + Math.sin(holder.face) * (PR + BR + 0.05);
    b.vx = holder.vx;
    b.vy = holder.vy;
    b.x = clamp(b.x, BR, L - BR);
    b.y = clamp(b.y, BR, W - BR);
  } else {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const f = Math.exp(-1.15 * dt);
    b.vx *= f;
    b.vy *= f;
    if (b.y < BR || b.y > W - BR) {
      b.y = clamp(b.y, BR, W - BR);
      b.vy *= -0.7;
      s.events.bounces++;
    }
    const inMouth = Math.abs(b.y - CY) < GOAL;
    if (b.x < 0 || b.x > L) {
      if (inMouth) {
        const scorer: 0 | 1 = b.x > L ? 0 : 1;
        s.score[scorer]++;
        s.events.goals++;
        s.note = { text: scorer === 0 ? `گُل! ${faDigits(s.score[0])} – ${faDigits(s.score[1])} 🎉` : `گل خوردید! ${faDigits(s.score[0])} – ${faDigits(s.score[1])}`, t: s.time };
        kickoff(s, scorer === 0 ? 1 : 0);
        return;
      }
      b.x = clamp(b.x, BR, L - BR);
      b.vx *= -0.7;
      s.events.bounces++;
    }
    // pick up a loose ball; keepers dive at shots (one roll per shot)
    const speed = Math.hypot(b.vx, b.vy);
    for (const p of s.players) {
      if (p.kickCd > 0) continue;
      const reach = p.role === "gk" ? PR + BR + 0.7 : PR + BR + 0.15;
      if (dist(p, b) > reach) continue;
      if (p.role === "gk" && speed > 12 && b.lastTeam !== p.team) {
        const key = `${p.id}:${b.kick}`;
        if (s.rolled.has(key)) continue;
        s.rolled.add(key);
        if (s.rand() >= (p.team === 1 ? AI[s.difficulty].save : OUR_SAVE)) continue;
        if (p.team === 1) s.note = { text: "دروازه‌بان مهار کرد! 🧤", t: s.time };
      } else if (p.role === "field" && speed > 17 && b.lastTeam !== p.team && s.rand() < 0.5) {
        // a hard shot can fly past a defender
        continue;
      }
      b.owner = p.id;
      b.lastTeam = p.team;
      p.hold = 0;
      if (p.team === 0 && p.role === "field") s.controlled = p.id;
      break;
    }
  }
}

/** For the result card. */
export function matchResult(s: FootballState) {
  const [gf, ga] = s.score;
  const won = gf > ga;
  const draw = gf === ga;
  return { gf, ga, won, draw, points: Math.max(0, gf * 100 + (won ? 200 : draw ? 50 : 0) + s.tackles * 5) };
}
