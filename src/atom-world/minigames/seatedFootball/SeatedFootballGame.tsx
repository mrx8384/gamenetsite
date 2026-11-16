"use client";

import { useEffect, useRef, useState } from "react";
import { characters } from "../../data/characters";
import { worldStore } from "../../store";
import { audio } from "../../systems/AudioManager";
import { pageFont } from "../city/city3d";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import { BALL_R, createSeated, FOOT_MAX_X, FOOT_R, GOAL_HALF, GOALS, HALF_L, HALF_W, type SeatedState, seatedResult, stepSeated } from "./engine";

const DIFF: Record<string, string> = { easy: "آسان", normal: "معمولی", hard: "سخت" };

/**
 * «فوتبال نشسته» on the FOOTBALLS table, seen from above: you sit at the near end (bottom), the rival
 * ATOM character at the far end. Slide your foot under the ball and kick it into the far goal.
 * Mouse / finger: move = slide the foot, tap or click = kick. Keys: ← → (or A D) and Space.
 */
export default function SeatedFootballGame({ paused, difficulty, onHud, onEnd }: MiniGameProps) {
  const [initial] = useState(() => createSeated(difficulty));
  const sim = useRef<SeatedState>(initial);
  const hud = useHudThrottle(onHud);
  const pausedRef = useRef(paused);
  const ended = useRef(false);
  const keys = useRef(new Set<string>());
  const target = useRef(0);
  const kick = useRef(false);
  const view = useRef({ cx: 0, cy: 0, k: 1 });
  const last = useRef({ goals: 0, hits: 0, bounces: 0 });
  const [colors] = useState(() => {
    const me = worldStore.get().character;
    const rival = me === "boy" ? "girl" : "boy";
    return { me: characters[me].look, rival: characters[rival].look, rivalName: characters[rival].name };
  });
  useEffect(() => exposeForTests(sim.current), []);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " " || k === "k" || k === "arrowup" || k === "w") {
        e.preventDefault();
        if (!e.repeat) kick.current = true;
        return;
      }
      if (k.startsWith("arrow")) e.preventDefault();
      keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const canvas = useCanvasLoop((g, w, h, dt) => {
    const s = sim.current;
    if (!pausedRef.current && !ended.current) {
      const k = keys.current;
      const dir = (k.has("arrowright") || k.has("d") ? 1 : 0) - (k.has("arrowleft") || k.has("a") ? 1 : 0);
      if (dir) target.current = Math.max(-FOOT_MAX_X, Math.min(FOOT_MAX_X, target.current + dir * 1.9 * dt));
      stepSeated(s, dt, { x: target.current, kick: kick.current });
      kick.current = false;
      const l = last.current;
      if (s.events.hits > l.hits) audio.footKick(Math.min(1, Math.hypot(s.ball.vx, s.ball.vy) / 3));
      if (s.events.goals > l.goals) audio.goal(s.note?.text.startsWith("گُل") ?? false);
      if (s.events.bounces > l.bounces) audio.hockeyWall(1.5);
      Object.assign(l, s.events);
    }
    hud([
      { label: "شما", value: fa(s.score.player) },
      { label: colors.rivalName, value: fa(s.score.ai) },
      { label: "زمان", value: formatTime(s.elapsed) },
    ]);
    draw(g, w, h, s, view.current, colors);
    if (s.over && !ended.current) {
      ended.current = true;
      const r = seatedResult(s);
      window.setTimeout(
        () =>
          onEnd({
            won: r.won,
            headline: r.won ? "بردید! قهرمان میز FOOTBALLS 🏆" : "این دست را باختید",
            lines: [
              `⚽ نتیجه: شما ${fa(r.goals)} – ${fa(r.against)} ${colors.rivalName}`,
              `⏱ مدت بازی: ${formatTime(s.elapsed)} — 🦶 ${fa(s.kicks)} ضربه`,
              "🥅 میزهای واقعی FOOTBALLS در طبقهٔ دوم مجموعهٔ اتم منتظر شما و دوستتان هستند.",
            ],
            score: r.points,
            detail: `${fa(r.goals)} – ${fa(r.against)} (${DIFF[s.difficulty]})`,
            stats: { won: r.won, hard: s.difficulty === "hard", goals: r.goals, against: r.against, seconds: Math.round(s.elapsed), kicks: s.kicks },
          }),
        700,
      );
    }
  });

  const aim = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const v = view.current;
    target.current = Math.max(-FOOT_MAX_X, Math.min(FOOT_MAX_X, (e.clientX - rect.left - v.cx) / v.k));
  };

  return (
    <div className={styles.paintGame}>
      <div className={styles.padScreen}>
        <canvas
          ref={canvas}
          className={styles.canvas}
          role="img"
          aria-label="میز FOOTBALLS از بالا: پای شما پایین، پای حریف بالا، توپ در قفس"
          onPointerMove={aim}
          onPointerDown={(e) => {
            aim(e);
            if (!pausedRef.current) kick.current = true;
          }}
        />
      </div>
    </div>
  );
}

type Look = { jacket: string; jacketAccent: string; shoe: string; shoeAccent: string; pants: string };

function draw(g: CanvasRenderingContext2D, w: number, h: number, s: SeatedState, view: { cx: number; cy: number; k: number }, colors: { me: Look; rival: Look }) {
  const SEAT = 0.42; // seats beyond each end
  const k = Math.min(w / (HALF_W * 2 + 0.5), h / ((HALF_L + SEAT) * 2 + 0.25));
  const cx = w / 2;
  const cy = h / 2;
  view.cx = cx;
  view.cy = cy;
  view.k = k;
  const X = (x: number) => cx + x * k;
  const Y = (y: number) => cy + y * k;

  // the upper floor's tiles
  g.fillStyle = "#d9d6cf";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "rgba(0,0,0,0.07)";
  g.lineWidth = 1;
  const tile = 0.6 * k;
  for (let x = cx % tile; x < w; x += tile) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  for (let y = cy % tile; y < h; y += tile) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }

  // red seats at both ends, the sitting players' legs
  for (const side of [-1, 1] as const) {
    const look = side === 1 ? colors.me : colors.rival;
    const foot = side === 1 ? s.me : s.ai;
    g.fillStyle = "#c92a2a";
    g.beginPath();
    g.roundRect(X(-HALF_W), Y(side === 1 ? HALF_L + 0.04 : -HALF_L - SEAT), HALF_W * 2 * k, (SEAT - 0.04) * k, 0.05 * k);
    g.fill();
    // body on the seat
    g.fillStyle = look.jacket;
    g.beginPath();
    g.ellipse(X(foot.x * 0.35), Y(side * (HALF_L + 0.24)), 0.2 * k, 0.13 * k, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = look.jacketAccent;
    g.fillRect(X(foot.x * 0.35) - 0.2 * k, Y(side * (HALF_L + 0.24)) - 0.012 * k, 0.4 * k, 0.024 * k);
    // the kicking leg from the hip to the foot
    g.strokeStyle = look.pants;
    g.lineWidth = 0.1 * k;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(X(foot.x * 0.35 + 0.07), Y(side * (HALF_L + 0.2)));
    g.lineTo(X(foot.x), Y(side * (foot.y + 0.05)));
    g.stroke();
  }

  // the table: black metal frame, red lane, goal mouths at the ends
  g.fillStyle = "#0e0e10";
  g.beginPath();
  g.roundRect(X(-HALF_W - 0.045), Y(-HALF_L - 0.045), (HALF_W * 2 + 0.09) * k, (HALF_L * 2 + 0.09) * k, 0.03 * k);
  g.fill();
  const lane = g.createLinearGradient(0, Y(-HALF_L), 0, Y(HALF_L));
  lane.addColorStop(0, "#b3262b");
  lane.addColorStop(0.5, "#d3363a");
  lane.addColorStop(1, "#b3262b");
  g.fillStyle = lane;
  g.fillRect(X(-HALF_W), Y(-HALF_L), HALF_W * 2 * k, HALF_L * 2 * k);
  g.strokeStyle = "rgba(255,255,255,0.75)";
  g.lineWidth = Math.max(1.5, 0.012 * k);
  g.beginPath();
  g.moveTo(X(-HALF_W), Y(0));
  g.lineTo(X(HALF_W), Y(0));
  g.stroke();
  g.beginPath();
  g.arc(X(0), Y(0), 0.14 * k, 0, Math.PI * 2);
  g.stroke();
  for (const side of [-1, 1]) {
    g.strokeRect(X(-GOAL_HALF - 0.07), Y(side === 1 ? HALF_L - 0.2 : -HALF_L), (GOAL_HALF * 2 + 0.14) * k, 0.2 * k);
    // goal mouth with a net
    g.fillStyle = "#101012";
    g.fillRect(X(-GOAL_HALF), Y(side === 1 ? HALF_L - 0.012 : -HALF_L - 0.045), GOAL_HALF * 2 * k, 0.057 * k);
    g.fillStyle = side === 1 ? "#39ff88" : "#ff4fa3";
    g.fillRect(X(-GOAL_HALF), Y(side === 1 ? HALF_L - 0.014 : -HALF_L), GOAL_HALF * 2 * k, 0.014 * k);
  }
  g.fillStyle = "rgba(255,255,255,0.14)";
  g.font = `900 ${Math.round(0.085 * k)}px ${pageFont()}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("FOOTBALLS", X(0), Y(-0.3));
  g.fillText("ATOM", X(0), Y(0.3));

  // ball with a shadow
  const b = s.ball;
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.beginPath();
  g.arc(X(b.x) + 0.012 * k, Y(b.y) + 0.016 * k, BALL_R * k, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f7f7f5";
  g.beginPath();
  g.arc(X(b.x), Y(b.y), BALL_R * k, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1c1c1f";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + (b.x + b.y) * 9;
    g.beginPath();
    g.arc(X(b.x) + Math.cos(a) * BALL_R * k * 0.55, Y(b.y) + Math.sin(a) * BALL_R * k * 0.55, BALL_R * k * 0.2, 0, Math.PI * 2);
    g.fill();
  }

  // the two shoes
  for (const side of [-1, 1] as const) {
    const look = side === 1 ? colors.me : colors.rival;
    const foot = side === 1 ? s.me : s.ai;
    const x = X(foot.x);
    const y = Y(side * foot.y);
    g.fillStyle = "rgba(0,0,0,0.28)";
    g.beginPath();
    g.ellipse(x + 0.012 * k, y + 0.018 * k, FOOT_R * k * 0.85, FOOT_R * k * 1.25, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = look.shoe;
    g.beginPath();
    g.ellipse(x, y, FOOT_R * k * 0.82, FOOT_R * k * 1.22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = look.shoeAccent;
    g.beginPath();
    g.ellipse(x, y - side * FOOT_R * k * 0.62, FOOT_R * k * 0.6, FOOT_R * k * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    if (side === 1) {
      g.strokeStyle = "rgba(255,255,255,0.9)";
      g.lineWidth = Math.max(1.5, 0.01 * k);
      g.beginPath();
      g.ellipse(x, y, FOOT_R * k * 1.05, FOOT_R * k * 1.45, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  // the cage over the lane (light grid) and its top rails
  g.strokeStyle = "rgba(255,255,255,0.1)";
  g.lineWidth = 1;
  const cell = 0.07 * k;
  for (let x = X(-HALF_W); x <= X(HALF_W) + 0.5; x += cell) {
    g.beginPath();
    g.moveTo(x, Y(-HALF_L));
    g.lineTo(x, Y(HALF_L));
    g.stroke();
  }
  for (let y = Y(-HALF_L); y <= Y(HALF_L) + 0.5; y += cell) {
    g.beginPath();
    g.moveTo(X(-HALF_W), y);
    g.lineTo(X(HALF_W), y);
    g.stroke();
  }

  // messages, goals needed
  g.direction = "rtl";
  if (s.note && s.time - s.note.t < 2.4) {
    g.globalAlpha = Math.min(1, 2.4 - (s.time - s.note.t));
    g.font = `700 ${w < 420 ? 14 : 16}px ${pageFont()}`;
    const tw = Math.min(w - 16, g.measureText(s.note.text).width + 28);
    g.fillStyle = "rgba(5,6,5,0.82)";
    g.beginPath();
    g.roundRect(w / 2 - tw / 2, 10, tw, 34, 17);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(s.note.text, w / 2, 27, tw - 16);
    g.globalAlpha = 1;
  }
  g.font = `600 12px ${pageFont()}`;
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillText(`اولین نفر با ${fa(GOALS)} گل برنده است`, w / 2, h - 12);
}
