"use client";

import { useEffect, useRef, useState } from "react";
import { audio } from "../../systems/AudioManager";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import { VirtualStick } from "../VirtualStick";
import { BR, createFootball, type FootballInput, type FootballState, GOAL, L, matchResult, PR, stepFootball, W } from "./engine";

const DIFF: Record<string, string> = { easy: "آسان", normal: "معمولی", hard: "سخت" };
const FONT = "Vazirmatn, Tahoma, sans-serif";
const COLORS = { field: ["#39ff88", "#ff4fa3"], gk: ["#f2c230", "#6c9bff"] } as const;

/**
 * «فوتبال اتم»: a top-down 3-on-3 futsal match (in the spirit of the football games played at the
 * gaming center). The camera follows the ball; a strip map shows the whole pitch on narrow screens.
 * Touch: joystick + «شوت / تکل» and «پاس / تعویض»; keys: arrows / WASD, Space or K, E or J.
 */
export default function FootballGame({ paused, difficulty, onHud, onEnd }: MiniGameProps) {
  const [initial] = useState(() => createFootball(difficulty));
  const sim = useRef<FootballState>(initial);
  const hud = useHudThrottle(onHud);
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0 });
  const shootBtn = useRef(false);
  const passBtn = useRef(false);
  const pausedRef = useRef(paused);
  const ended = useRef(false);
  const cam = useRef({ x: L / 2, y: W / 2 });
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [hasBall, setHasBall] = useState(false);
  const last = useRef({ kicks: 0, goals: 0, bounces: 0 });
  useEffect(() => exposeForTests(sim.current), []);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") {
        e.preventDefault();
        if (!e.repeat) shootBtn.current = true;
        return;
      }
      if (k === "e" || k === "j" || k === "enter") {
        e.preventDefault();
        if (!e.repeat) passBtn.current = true;
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
      const ax = (pos: string[], neg: string[]) => (pos.some((p) => k.has(p)) ? 1 : 0) - (neg.some((n) => k.has(n)) ? 1 : 0);
      const input: FootballInput = {
        x: clamp1(ax(["arrowright", "d"], ["arrowleft", "a"]) + stick.current.x),
        y: clamp1(ax(["arrowup", "w"], ["arrowdown", "s"]) + stick.current.y),
        shoot: shootBtn.current,
        pass: passBtn.current,
      };
      shootBtn.current = passBtn.current = false;
      stepFootball(s, dt, input);
      const l = last.current;
      if (s.events.kicks > l.kicks) audio.footKick(Math.min(1, Math.hypot(s.ball.vx, s.ball.vy) / 24));
      if (s.events.goals > l.goals) audio.goal(s.note?.text.startsWith("گُل") ?? false);
      if (s.events.bounces > l.bounces) audio.hockeyWall(2);
      Object.assign(l, s.events);
      const mine = s.ball.owner === s.controlled;
      if (mine !== hasBall) setHasBall(mine);
    }
    hud([
      { label: "زمان", value: formatTime(s.left), warn: s.left < 15 },
      { label: "اتم – حریف", value: `${fa(s.score[0])} – ${fa(s.score[1])}` },
    ]);
    draw(g, w, h, s, cam.current, dt);
    if (s.over && !ended.current) {
      ended.current = true;
      const r = matchResult(s);
      onEnd({
        won: r.won,
        headline: r.won ? "بردید! قهرمان زمین اتم 🏆" : r.draw ? "مساوی شد!" : "این بار حریف برد!",
        lines: [
          `⚽ نتیجه: اتم ${fa(r.gf)} – ${fa(r.ga)} حریف`,
          `🎯 ${fa(s.shots)} شوت — 🦵 ${fa(s.tackles)} توپ‌گیری`,
          "🎮 این بازی نمایشی است؛ برای بازی‌های فوتبال واقعی روی PS4 و PS5 به گیم‌نت اتم سر بزنید.",
        ],
        score: r.points,
        detail: `${fa(r.gf)} – ${fa(r.ga)} (${DIFF[s.difficulty]})`,
        stats: { goalsFor: r.gf, goalsAgainst: r.ga, won: r.won, shots: s.shots, tackles: s.tackles, hard: s.difficulty === "hard" },
      });
    }
  });

  const setStick = (x: number, y: number) => {
    stick.current = { x, y };
  };

  return (
    <div className={`${styles.digLayout} ${touch ? styles.digTouch : ""}`}>
      <div className={styles.canvasBox}>
        <canvas ref={canvas} role="img" aria-label="زمین فوتسال از بالا: تیم سبز اتم در برابر تیم صورتی" />
      </div>
      {touch && (
        <>
          <div className={styles.padLeft}>
            <VirtualStick label="حرکت بازیکن" up="بالا" down="پایین" left="◀" right="▶" onChange={setStick} />
          </div>
          <div className={styles.padRight} style={{ flexDirection: "column", gap: "0.5rem", alignItems: "flex-end", justifyContent: "flex-end" }}>
            <button type="button" className={styles.cityBtn} onPointerDown={() => (passBtn.current = true)}>
              {hasBall ? "↪ پاس" : "🔄 تعویض"}
            </button>
            <button type="button" className={`${styles.cityBtn} ${styles.cityBtnMain}`} onPointerDown={() => (shootBtn.current = true)}>
              {hasBall ? "⚽ شوت" : "🦵 تکل"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

function draw(g: CanvasRenderingContext2D, w: number, h: number, s: FootballState, cam: { x: number; y: number }, dt: number) {
  // the whole pitch when it stays readable (wide screens); on phones fit one direction and follow the ball
  const fit = Math.min(w / (L + 4), h / (W + 4));
  const z = fit >= 11 ? fit : Math.max(w / (L + 4), h / (W + 4));
  const vw = w / z;
  const vh = h / z;
  const want = (c: number, view: number, size: number) => (view >= size + 4 ? size / 2 : Math.max(view / 2 - 2, Math.min(size + 2 - view / 2, c)));
  cam.x += (want(s.ball.x, vw, L) - cam.x) * Math.min(1, dt * 4);
  cam.y += (want(s.ball.y, vh, W) - cam.y) * Math.min(1, dt * 4);
  const toS = (x: number, y: number): [number, number] => [(x - cam.x) * z + w / 2, (y - cam.y) * z + h / 2];

  g.fillStyle = "#14261a";
  g.fillRect(0, 0, w, h);
  // grass stripes
  const [px, py] = toS(0, 0);
  for (let k = 0; k < 12; k++) {
    g.fillStyle = k % 2 ? "#2e8a3e" : "#33964a";
    g.fillRect(px + (k * L * z) / 12, py, (L * z) / 12 + 1, W * z);
  }
  // boards
  g.strokeStyle = "#0b0d0b";
  g.lineWidth = Math.max(3, z * 0.4);
  g.strokeRect(px - z * 0.2, py - z * 0.2, L * z + z * 0.4, W * z + z * 0.4);
  // lines
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = Math.max(1.5, z * 0.12);
  g.strokeRect(px, py, L * z, W * z);
  g.beginPath();
  g.moveTo(...toS(L / 2, 0));
  g.lineTo(...toS(L / 2, W));
  g.stroke();
  g.beginPath();
  g.arc(...toS(L / 2, W / 2), 5 * z, 0, Math.PI * 2);
  g.stroke();
  for (const side of [0, 1]) {
    const x0 = side ? L - 7 : 0;
    const [ax, ay] = toS(x0, W / 2 - 8);
    g.strokeRect(ax, ay, 7 * z, 16 * z);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(...toS(side ? L - 5 : 5, W / 2), z * 0.2, 0, Math.PI * 2);
    g.fill();
  }
  // goals with nets (green side defends the left one)
  for (const side of [0, 1]) {
    const [gx, gy] = toS(side ? L : -1.6, W / 2 - GOAL);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(gx, gy, 1.6 * z, GOAL * 2 * z);
    g.strokeStyle = "rgba(255,255,255,0.35)";
    g.lineWidth = 1;
    for (let k = 1; k < 8; k++) {
      g.beginPath();
      g.moveTo(gx, gy + (k * GOAL * 2 * z) / 8);
      g.lineTo(gx + 1.6 * z, gy + (k * GOAL * 2 * z) / 8);
      g.stroke();
    }
    g.strokeStyle = side ? "#ff4fa3" : "#39ff88";
    g.lineWidth = Math.max(2, z * 0.25);
    g.strokeRect(gx, gy, 1.6 * z, GOAL * 2 * z);
  }
  // ATOM in the centre circle
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.font = `900 ${Math.round(z * 2.2)}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("ATOM", ...toS(L / 2, W / 2));

  // players
  for (const p of s.players) {
    const [x, y] = toS(p.x, p.y);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(x + z * 0.2, y + z * 0.25, PR * z, PR * z * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    if (p.id === s.controlled) {
      g.strokeStyle = "#fff";
      g.lineWidth = Math.max(2, z * 0.15);
      g.beginPath();
      g.arc(x, y, PR * z * 1.55, 0, Math.PI * 2);
      g.stroke();
      // direction pointer
      g.fillStyle = "#fff";
      g.beginPath();
      const a = p.face;
      const r = PR * z * 1.9;
      g.moveTo(x + Math.cos(a) * (r + z * 0.6), y + Math.sin(a) * (r + z * 0.6));
      g.lineTo(x + Math.cos(a + 0.35) * r, y + Math.sin(a + 0.35) * r);
      g.lineTo(x + Math.cos(a - 0.35) * r, y + Math.sin(a - 0.35) * r);
      g.closePath();
      g.fill();
    }
    g.fillStyle = COLORS[p.role][p.team];
    g.beginPath();
    g.arc(x, y, PR * z, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = "#050605";
    g.font = `800 ${Math.round(z * 0.9)}px ${FONT}`;
    g.fillText(fa(p.num), x, y + z * 0.05);
  }

  // ball
  const [bx, by] = toS(s.ball.x, s.ball.y);
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.arc(bx + z * 0.15, by + z * 0.2, BR * z, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(bx, by, BR * z * 1.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#222";
  g.beginPath();
  g.arc(bx, by, BR * z * 0.4, 0, Math.PI * 2);
  g.fill();

  // strip map when the pitch doesn't fit
  if (vw < L) {
    const mw = Math.min(150, w * 0.4);
    const k = mw / L;
    const mh = W * k;
    const mx = w / 2 - mw / 2;
    const my = h - mh - 10;
    g.fillStyle = "rgba(5,6,5,0.7)";
    g.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
    g.fillStyle = "#2e8a3e";
    g.fillRect(mx, my, mw, mh);
    g.strokeStyle = "rgba(255,255,255,0.6)";
    g.lineWidth = 1;
    g.strokeRect(mx + (cam.x - vw / 2) * k, my, vw * k, mh);
    for (const p of s.players) {
      g.fillStyle = COLORS[p.role][p.team];
      g.beginPath();
      g.arc(mx + p.x * k, my + p.y * k, 2.5, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#fff";
    g.beginPath();
    g.arc(mx + s.ball.x * k, my + s.ball.y * k, 2, 0, Math.PI * 2);
    g.fill();
  }

  // messages
  if (s.note && s.time - s.note.t < 2.5) {
    g.globalAlpha = Math.min(1, 2.5 - (s.time - s.note.t));
    g.font = `700 16px ${FONT}`;
    const tw = g.measureText(s.note.text).width + 28;
    g.fillStyle = "rgba(5,6,5,0.8)";
    g.beginPath();
    g.roundRect(w / 2 - tw / 2, 10, tw, 34, 17);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(s.note.text, w / 2, 27);
    g.globalAlpha = 1;
  }
}
