"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { useWorld } from "../../store";
import { audio } from "../../systems/AudioManager";
import { QUALITY_PRESETS } from "../../systems/QualityManager";
import { pageFont } from "../city/city3d";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import { VirtualStick } from "../VirtualStick";
import { createFootball, type FootballInput, type FootballState, L, matchResult, stepFootball, W } from "./engine";
import { FootballScene, type FootballView } from "./FootballScene";

const DIFF: Record<string, string> = { easy: "آسان", normal: "معمولی", hard: "سخت" };
const COLORS = { field: ["#39ff88", "#ff4fa3"], gk: ["#f2c230", "#6c9bff"] } as const;

/**
 * «فوتبال اتم» in 3D: a 3-on-3 futsal match (in the spirit of the football games played at the
 * gaming center) on a floodlit court. The camera follows the ball from the side like TV; on tall
 * phone screens it looks from behind ATOM's attack and the controls turn with it. An overlay keeps
 * the messages and a small map of the whole pitch. The rules are unchanged (./engine.ts).
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
  const view = useRef<FootballView>({ mode: "side" });
  const quality = useWorld((st) => st.quality);
  const preset = QUALITY_PRESETS[quality];
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

  /** One rules step (called by the 3D scene every frame, before it draws). */
  const tick = (dt: number) => {
    const s = sim.current;
    if (!pausedRef.current && !ended.current) {
      const k = keys.current;
      const ax = (pos: string[], neg: string[]) => (pos.some((p) => k.has(p)) ? 1 : 0) - (neg.some((n) => k.has(n)) ? 1 : 0);
      const rx = clamp1(ax(["arrowright", "d"], ["arrowleft", "a"]) + stick.current.x);
      const ry = clamp1(ax(["arrowup", "w"], ["arrowdown", "s"]) + stick.current.y);
      // from behind ATOM's attack, «up» runs towards the rival goal and «right» across the pitch
      const behind = view.current.mode === "behind";
      const input: FootballInput = {
        x: behind ? ry : rx,
        y: behind ? -rx : ry,
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
  };
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  // messages and a small map of the whole pitch, drawn over the 3D view
  const overlay = useCanvasLoop((g, w, h) => {
    g.clearRect(0, 0, w, h);
    drawOverlay(g, w, h, sim.current, view.current.mode, touch);
  });

  const setStick = (x: number, y: number) => {
    stick.current = { x, y };
  };

  return (
    <div className={`${styles.digLayout} ${touch ? styles.digTouch : ""}`}>
      <div className={styles.canvasBox} role="img" aria-label="زمین فوتسال سه‌بعدی: تیم سبز اتم در برابر تیم صورتی">
        <Canvas
          flat
          dpr={[1, preset.maxDpr]}
          gl={{ antialias: preset.antialias, powerPreference: "high-performance", stencil: false }}
          camera={{ fov: 40, near: 0.3, far: 220, position: [0, 15, W / 2 + 17] }}
          style={{ position: "absolute", inset: 0, touchAction: "none" }}
        >
          <FootballScene initial={initial} simRef={sim} tickRef={tickRef} viewRef={view} low={quality === "low"} />
        </Canvas>
        <canvas ref={overlay} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
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

/** The latest message (top) and a small map of the whole pitch, turned like the camera. */
function drawOverlay(g: CanvasRenderingContext2D, w: number, h: number, s: FootballState, mode: FootballView["mode"], touch: boolean) {
  const font = pageFont();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.direction = "rtl";
  if (s.note && s.time - s.note.t < 2.5) {
    g.globalAlpha = Math.min(1, 2.5 - (s.time - s.note.t));
    g.font = `700 ${w < 420 ? 14 : 16}px ${font}`;
    const tw = Math.min(w - 16, g.measureText(s.note.text).width + 28);
    g.fillStyle = "rgba(5,6,5,0.8)";
    g.beginPath();
    g.roundRect(w / 2 - tw / 2, 10, tw, 34, 17);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(s.note.text, w / 2, 27, tw - 16);
    g.globalAlpha = 1;
  }

  // map: the pitch as the camera sees it (side: ATOM attacks right; behind: ATOM attacks up)
  const side = mode === "side";
  const long = Math.min(side ? 150 : 130, (side ? w : h) * 0.3);
  const k = long / L;
  const mw = side ? long : W * k;
  const mh = side ? W * k : long;
  const mx = 10;
  const my = side ? h - mh - (touch ? 10 : 12) : 52;
  const at = (x: number, y: number): [number, number] => (side ? [mx + x * k, my + y * k] : [mx + y * k, my + mh - x * k]);
  g.fillStyle = "rgba(5,6,5,0.65)";
  g.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
  g.fillStyle = "#2e8a3e";
  g.fillRect(mx, my, mw, mh);
  g.strokeStyle = "rgba(255,255,255,0.55)";
  g.lineWidth = 1;
  g.strokeRect(mx, my, mw, mh);
  g.beginPath();
  g.moveTo(...at(L / 2, 0));
  g.lineTo(...at(L / 2, W));
  g.stroke();
  for (const p of s.players) {
    g.fillStyle = COLORS[p.role][p.team];
    g.beginPath();
    g.arc(...at(p.x, p.y), p.id === s.controlled ? 3.6 : 2.6, 0, Math.PI * 2);
    g.fill();
    if (p.id === s.controlled) {
      g.strokeStyle = "#fff";
      g.lineWidth = 1.2;
      g.stroke();
    }
  }
  g.fillStyle = "#fff";
  g.beginPath();
  g.arc(...at(s.ball.x, s.ball.y), 2, 0, Math.PI * 2);
  g.fill();
}
