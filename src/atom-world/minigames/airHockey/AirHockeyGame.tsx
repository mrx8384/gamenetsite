"use client";

import { useEffect, useRef, useState } from "react";
import { audio } from "../../systems/AudioManager";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import type { Message } from "../../online/connection";
import { createHockey, type HockeyEvent, type HockeyState, stepHockey, TABLE, WIN_SCORE } from "./engine";

const GREEN = "#39ff88";
const PINK = "#ff4fa0";

/**
 * Air hockey against the computer, drawn like the club's tables: white air surface, dark rails with
 * LED strips (green on the player's side, pink on the computer's side).
 * Portrait screens: the player is at the bottom. Landscape: the player is on the right.
 */
export default function AirHockeyGame({ paused, difficulty, players, online, onHud, onEnd }: MiniGameProps) {
  const sim = useRef<HockeyState>(createHockey(difficulty, players === 2));
  // online: the room creator (seat 0) runs the physics; the friend (seat 1) shows it turned around
  const [net] = useState(() => online ?? null);
  const [seat] = useState<0 | 1>(() => online?.state.get().seat ?? 0);
  const isGuest = !!net && seat === 1;
  const peerName = net?.state.get().peerName ?? "دوست شما";
  const remote = useRef<{ snap: Snapshot | null; at: number; lastSent: number }>({ snap: null, at: 0, lastSent: 0 });
  /** pointer id → which mallet it drives (two players: by the half where the finger landed) */
  const fingers = useRef(new Map<number, 1 | 2>());
  const hud = useHudThrottle(onHud);
  const keys = useRef(new Set<string>());
  const view = useRef<View>({ cx: 0, cy: 0, scale: 1, landscape: false });
  const trail = useRef<{ x: number; y: number }[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const ended = useRef(false);
  const pausedRef = useRef(paused);
  useEffect(() => exposeForTests(sim.current), []);

  // online messages: the host takes the friend's mallet position; the friend takes the host's snapshots
  useEffect(() => {
    if (!net) return;
    return net.on((m) => {
      const s = sim.current;
      if (m.t === "in" && !isGuest && fin(m.x) && fin(m.y)) s.target2 = { x: m.x as number, y: m.y as number };
      if (m.t === "st" && isGuest && validSnapshot(m)) remote.current = { ...remote.current, snap: m, at: performance.now() };
      if (m.t === "ev" && isGuest && Array.isArray(m.e))
        for (const e of m.e.slice(0, 20) as HockeyEvent[]) if (e && (e.type === "hit" || e.type === "wall" ? fin(e.v) : e.type === "goal" && (e.scorer === "player" || e.scorer === "ai"))) playEvent(e);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playEvent only touches refs / state setters
  }, [net, isGuest]);

  function playEvent(e: HockeyEvent) {
    if (e.type === "hit") audio.hockeyHit(e.v);
    else if (e.type === "wall") audio.hockeyWall(e.v);
    else {
      const mine = net ? (e.scorer === "player") === (seat === 0) : e.scorer === "player";
      audio.goal(net ? mine : e.scorer === "player");
      setFlash(net ? (mine ? "گل شما! ⚽" : `گل ${peerName}`) : s2pGoal(e.scorer));
      trail.current = [];
    }
  }
  function s2pGoal(scorer: "player" | "ai") {
    return sim.current.twoPlayer ? `گل بازیکن ${scorer === "player" ? "۱ (سبز)" : "۲ (صورتی)"}! ⚽` : scorer === "player" ? "گل! ⚽" : "گل حریف";
  }
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1100);
    return () => window.clearTimeout(t);
  }, [flash]);

  const canvas = useCanvasLoop((ctx, w, h, dt) => {
    const s = sim.current;
    const landscape = w > h * 1.15;
    const long = TABLE.L + 0.22;
    const short = TABLE.W + 0.22;
    const scale = landscape ? Math.min(w / long, h / short) : Math.min(w / short, h / long);
    view.current = { cx: w / 2, cy: h / 2, scale, landscape, flip: isGuest };

    if (isGuest && !ended.current) {
      guestFrame(s, dt, landscape);
    } else if (!pausedRef.current && !ended.current) {
      // keyboard moves the target
      const k = keys.current;
      const axis = (pos: string[], neg: string[]) => (pos.some((p) => k.has(p)) ? 1 : 0) - (neg.some((n) => k.has(n)) ? 1 : 0);
      // one player: arrows or WASD; two players: arrows = player 1, WASD = player 2
      const split = s.twoPlayer && !net; // two players on this keyboard
      const p1 = split ? { x: axis(["arrowright"], ["arrowleft"]), y: axis(["arrowdown"], ["arrowup"]) } : { x: axis(["arrowright", "d"], ["arrowleft", "a"]), y: axis(["arrowdown", "s"], ["arrowup", "w"]) };
      const nudge = (t: { x: number; y: number }, kx: number, ky: number, yMin: number, yMax: number) => {
        if (!kx && !ky) return;
        // screen directions → table directions
        const tx = landscape ? -ky : kx;
        const ty = landscape ? kx : ky;
        t.x = Math.max(-0.5, Math.min(0.5, t.x + tx * 1.8 * dt));
        t.y = Math.max(yMin, Math.min(yMax, t.y + ty * 1.8 * dt));
      };
      nudge(s.target, p1.x, p1.y, 0, TABLE.L / 2);
      if (split) nudge(s.target2, axis(["d"], ["a"]), axis(["s"], ["w"]), -TABLE.L / 2, 0);
      const events = stepHockey(s, dt);
      for (const e of events) playEvent(e);
      if (net) {
        // host → friend: events right away, positions 20 times a second
        const sound = events.filter((e) => e.type !== "wall" || e.v > 0.5);
        if (sound.length) net.send({ t: "ev", e: sound });
        const now = performance.now();
        if (now - remote.current.lastSent > 50 || s.over) {
          remote.current.lastSent = now;
          const snap: Snapshot = { t: "st", p: [s.puck.x, s.puck.y, s.puck.vx, s.puck.vy], m: [s.player.x, s.player.y], a: [s.ai.x, s.ai.y], s: [s.score.player, s.score.ai], over: s.over, pause: s.pause };
          net.send(snap as unknown as Message, true);
        }
      }
      if (s.over && !ended.current) {
        ended.current = true;
        const won = s.score.player > s.score.ai;
        if (net) {
          window.setTimeout(() => onEnd(onlineResult(won, s)), 700);
          return;
        }
        if (s.twoPlayer) {
          window.setTimeout(
            () =>
              onEnd({
                won: true,
                twoPlayer: true,
                score: 0,
                detail: "",
                stats: {},
                headline: `🏆 بازیکن ${won ? "۱ (سبز)" : "۲ (صورتی)"} برد!`,
                lines: [`نتیجه: بازیکن ۱ ${fa(s.score.player)} — بازیکن ۲ ${fa(s.score.ai)}`, `مدت بازی: ${formatTime(s.elapsed)}`],
              }),
            700,
          );
          return;
        }
        const level = { easy: 1, normal: 2, hard: 3 }[s.difficulty];
        const levelName = { easy: "آسان", normal: "معمولی", hard: "سخت" }[s.difficulty];
        // points: goals scored, a win bonus that grows with the level, minus goals conceded
        const points = s.score.player * 40 + (won ? 200 * level : 0) - s.score.ai * 20;
        window.setTimeout(
          () =>
            onEnd({
              won,
              score: Math.max(0, points),
              detail: `${fa(s.score.player)} – ${fa(s.score.ai)} (${levelName})`,
              stats: { won, hard: s.difficulty === "hard", goals: s.score.player, against: s.score.ai, seconds: Math.round(s.elapsed) },
              headline: won ? "🏆 بردید!" : "این دست را باختید",
              lines: [`نتیجه: شما ${fa(s.score.player)} — حریف ${fa(s.score.ai)}`, `مدت بازی: ${formatTime(s.elapsed)}`, won ? "برای چالش بیشتر سطح سخت‌تر را امتحان کنید." : "دوباره امتحان کنید؛ دیسک را از کنار دیواره به دروازه بزنید."],
            }),
          700,
        );
      }
    }
    hud(
      net
        ? [
            { label: "شما", value: fa(seat === 0 ? s.score.player : s.score.ai) },
            { label: peerName, value: fa(seat === 0 ? s.score.ai : s.score.player) },
            { label: "گل برای برد", value: fa(WIN_SCORE) },
          ]
        : s.twoPlayer
        ? [
            { label: "بازیکن ۱ (سبز)", value: fa(s.score.player) },
            { label: "بازیکن ۲ (صورتی)", value: fa(s.score.ai) },
            { label: "گل برای برد", value: fa(WIN_SCORE) },
          ]
        : [
            { label: "شما", value: fa(s.score.player) },
            { label: "حریف", value: fa(s.score.ai) },
            { label: "گل برای برد", value: fa(WIN_SCORE) },
          ],
    );
    trail.current.push({ x: s.puck.x, y: s.puck.y });
    if (trail.current.length > 10) trail.current.shift();
    draw(ctx, w, h, s, view.current, trail.current);
  });

  /** Friend's phone: show the host's latest state (puck extrapolated), own mallet follows the finger at once. */
  function guestFrame(s: HockeyState, dt: number, landscape: boolean) {
    const k = keys.current;
    const axis = (pos: string[], neg: string[]) => (pos.some((p) => k.has(p)) ? 1 : 0) - (neg.some((n) => k.has(n)) ? 1 : 0);
    const kx = axis(["arrowright", "d"], ["arrowleft", "a"]);
    const ky = axis(["arrowdown", "s"], ["arrowup", "w"]);
    if (kx || ky) {
      // the table is turned around on this phone: screen directions are reversed
      const tx = -(landscape ? -ky : kx);
      const ty = -(landscape ? kx : ky);
      s.target2.x = Math.max(-0.5, Math.min(0.5, s.target2.x + tx * 1.8 * dt));
      s.target2.y = Math.max(-TABLE.L / 2, Math.min(0, s.target2.y + ty * 1.8 * dt));
    }
    const r = remote.current;
    const now = performance.now();
    if (now - r.lastSent > 50) {
      r.lastSent = now;
      net!.send({ t: "in", x: s.target2.x, y: s.target2.y }, true);
    }
    // own mallet: straight to the finger (clamped to the own half)
    const t = { x: Math.max(-0.43, Math.min(0.43, s.target2.x)), y: Math.max(-TABLE.L / 2 + 0.07, Math.min(-0.035, s.target2.y)) };
    const f = 1 - Math.exp(-dt * 25);
    s.ai.x += (t.x - s.ai.x) * f;
    s.ai.y += (t.y - s.ai.y) * f;
    const snap = r.snap;
    if (!snap) return;
    const age = Math.min(0.15, (now - r.at) / 1000);
    const still = snap.pause > 0 ? 0 : 1;
    s.puck.x = snap.p[0] + snap.p[2] * age * still;
    s.puck.y = snap.p[1] + snap.p[3] * age * still;
    s.player.x += (snap.m[0] - s.player.x) * f;
    s.player.y += (snap.m[1] - s.player.y) * f;
    s.score.player = snap.s[0];
    s.score.ai = snap.s[1];
    if (snap.over && !ended.current) {
      ended.current = true;
      const won = snap.s[1] > snap.s[0];
      window.setTimeout(() => onEnd(onlineResult(won, s)), 700);
    }
  }

  function onlineResult(won: boolean, s: HockeyState) {
    const mine = seat === 0 ? s.score.player : s.score.ai;
    const theirs = seat === 0 ? s.score.ai : s.score.player;
    return {
      won,
      twoPlayer: true,
      score: 0,
      detail: "",
      stats: {},
      headline: won ? "🏆 شما بردید!" : `${peerName} برد`,
      lines: [`نتیجه: شما ${fa(mine)} — ${peerName} ${fa(theirs)}`, "بازی آنلاین با دوست"],
    };
  }

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== "mouse" && e.buttons === 0 && e.type === "pointermove") return;
    const s = sim.current;
    const r = e.currentTarget.getBoundingClientRect();
    const t = toTable(view.current, e.clientX - r.left, e.clientY - r.top);
    let side: 1 | 2 = isGuest ? 2 : 1;
    if (s.twoPlayer && !net && e.pointerType !== "mouse") {
      side = fingers.current.get(e.pointerId) ?? (t.y < 0 ? 2 : 1);
      fingers.current.set(e.pointerId, side);
    }
    const target = side === 2 ? s.target2 : s.target;
    target.x = t.x;
    target.y = t.y;
  };
  const release = (e: React.PointerEvent) => {
    fingers.current.delete(e.pointerId);
  };

  return (
    <div className={styles.canvasBox}>
      <canvas
        ref={canvas}
        className={styles.canvas}
        aria-label="میز ایرهاکی. دسته را با ماوس یا انگشت در نیمهٔ سبز میز حرکت دهید."
        role="img"
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
          onPointer(e);
        }}
        onPointerMove={onPointer}
        onPointerUp={release}
        onPointerCancel={release}
      />
      {flash && (
        <div className={styles.flash} role="status">
          {flash}
        </div>
      )}
    </div>
  );
}

interface View {
  cx: number;
  cy: number;
  scale: number;
  landscape: boolean;
  /** online friend: the table is shown turned around (own mallet at the bottom) */
  flip?: boolean;
}

/** Position message from the host (online). */
interface Snapshot {
  t: "st";
  p: [number, number, number, number];
  m: [number, number];
  a: [number, number];
  s: [number, number];
  over: boolean;
  pause: number;
}

const fin = (v: unknown) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 100;
const pair = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every(fin);

/** Host snapshot from the friend's phone: finite numbers only (a bad message is ignored, never crashes). */
export function validSnapshot(m: unknown): m is Snapshot {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return pair(o.p, 4) && pair(o.m, 2) && pair(o.a, 2) && pair(o.s, 2) && typeof o.over === "boolean" && fin(o.pause);
}

/** Screen point (CSS px) → table space. */
function toTable(v: View, sx: number, sy: number) {
  const t = v.landscape ? { x: -(sy - v.cy) / v.scale, y: (sx - v.cx) / v.scale } : { x: (sx - v.cx) / v.scale, y: (sy - v.cy) / v.scale };
  return v.flip ? { x: -t.x, y: -t.y } : t;
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: HockeyState, v: View, tr: { x: number; y: number }[]) {
    const { scale, landscape } = v;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(v.cx, v.cy);
    if (landscape) ctx.rotate(-Math.PI / 2);
    if (v.flip) ctx.rotate(Math.PI);
    ctx.scale(scale, scale);
    // from here: table space (x right, y down towards the player)
    const W = TABLE.W;
    const L = TABLE.L;
    const rail = 0.07;
    // cabinet + rails
    ctx.fillStyle = "#15181a";
    roundRect(ctx, -W / 2 - rail, -L / 2 - rail, W + rail * 2, L + rail * 2, 0.08);
    ctx.fill();
    // LED strips (pink for the computer's half, green for the player's)
    ctx.lineWidth = 0.018;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = PINK;
    ctx.shadowColor = PINK;
    ctx.beginPath();
    ctx.moveTo(-W / 2 - rail * 0.5, 0);
    ctx.lineTo(-W / 2 - rail * 0.5, -L / 2 - rail * 0.5);
    ctx.lineTo(W / 2 + rail * 0.5, -L / 2 - rail * 0.5);
    ctx.lineTo(W / 2 + rail * 0.5, 0);
    ctx.stroke();
    ctx.strokeStyle = GREEN;
    ctx.shadowColor = GREEN;
    ctx.beginPath();
    ctx.moveTo(-W / 2 - rail * 0.5, 0);
    ctx.lineTo(-W / 2 - rail * 0.5, L / 2 + rail * 0.5);
    ctx.lineTo(W / 2 + rail * 0.5, L / 2 + rail * 0.5);
    ctx.lineTo(W / 2 + rail * 0.5, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // white air surface with holes
    ctx.fillStyle = "#f4f6f7";
    ctx.fillRect(-W / 2, -L / 2, W, L);
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    for (let y = -L / 2 + 0.04; y < L / 2; y += 0.06) for (let x = -W / 2 + 0.04; x < W / 2; x += 0.06) ctx.fillRect(x, y, 0.006, 0.006);
    // markings
    ctx.lineWidth = 0.008;
    ctx.strokeStyle = "rgba(255,79,160,0.7)";
    ctx.beginPath();
    ctx.moveTo(-W / 2, 0);
    ctx.lineTo(W / 2, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(20,30,40,0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, 0.14, 0, Math.PI * 2);
    ctx.stroke();
    for (const e of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(0, (e * L) / 2, TABLE.goal * 0.62, e > 0 ? Math.PI : 0, e > 0 ? Math.PI * 2 : Math.PI);
      ctx.stroke();
    }
    // goals
    ctx.fillStyle = "#050605";
    ctx.fillRect(-TABLE.goal / 2, -L / 2 - rail, TABLE.goal, rail * 0.8);
    ctx.fillRect(-TABLE.goal / 2, L / 2 + rail * 0.2, TABLE.goal, rail * 0.8);
    // ATOM mark
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#050605";
    ctx.scale(0.01, 0.01); // tiny font sizes are unreliable: draw text at 100×
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ATOM", 0, 42);
    ctx.fillText("ATOM", 0, -42);
    ctx.restore();
    // puck trail + puck
    tr.forEach((p, i) => {
      ctx.fillStyle = `rgba(30,30,30,${(i / tr.length) * 0.12})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, TABLE.puckR * 0.9, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(s.puck.x, s.puck.y, TABLE.puckR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.arc(s.puck.x, s.puck.y, TABLE.puckR * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    if (s.twoPlayer) {
      // each player's score on their own end, facing them (the device lies flat between them)
      for (const [y, flip, n, c] of [
        [TABLE.L / 2 - 0.3, false, s.score.player, GREEN],
        [-TABLE.L / 2 + 0.3, true, s.score.ai, PINK],
      ] as const) {
        ctx.save();
        ctx.translate(0, y);
        if (flip) ctx.rotate(Math.PI);
        ctx.scale(0.01, 0.01);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = c;
        ctx.font = "bold 34px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(fa(n), 0, 0);
        ctx.restore();
      }
    }
    mallet(ctx, s.ai.x, s.ai.y, PINK);
    mallet(ctx, s.player.x, s.player.y, GREEN);
    ctx.restore();
  }


function mallet(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, TABLE.malletR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(x, y, TABLE.malletR * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, TABLE.malletR * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
