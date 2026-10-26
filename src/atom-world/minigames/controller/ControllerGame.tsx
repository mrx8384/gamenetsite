"use client";

import { useEffect, useRef, useState } from "react";
import { getMachine } from "../../data/machines";
import { worldStore } from "../../store";
import { audio } from "../../systems/AudioManager";
import { worldItems } from "../../world/registry";
import { slotText } from "../../world/slots";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import { type Btn, type ControllerState, createController, DPAD, FACE, multiplier, press, step } from "./engine";

const COLOR: Record<Btn, string> = {
  triangle: "#38d9a0",
  circle: "#ff5a5f",
  cross: "#6c9bff",
  square: "#ff7ad9",
  up: "#f4f6f4",
  right: "#f4f6f4",
  down: "#f4f6f4",
  left: "#f4f6f4",
};
const NAME: Record<Btn, string> = { triangle: "مثلث", circle: "دایره", cross: "ضربدر", square: "مربع", up: "بالا", right: "راست", down: "پایین", left: "چپ" };
const GLYPH: Record<Btn, string> = { triangle: "△", circle: "○", cross: "✕", square: "□", up: "▲", right: "▶", down: "▼", left: "◀" };
const KEYS: Record<string, Btn> = { i: "triangle", l: "circle", k: "cross", j: "square", arrowup: "up", w: "up", arrowright: "right", d: "right", arrowdown: "down", s: "down", arrowleft: "left", a: "left" };
const DIFF: Record<string, string> = { easy: "آسان", normal: "معمولی", hard: "سخت" };

/** Which station the game was opened at, and the gaming center's stations (admin layout included). */
export function stationContext(fromId: string | null) {
  const stations = worldItems()
    .filter((i) => i.kind === "gc-station" && i.number !== undefined)
    .sort((a, b) => a.number! - b.number!);
  const here = stations.find((i) => i.id === fromId) ?? null;
  return {
    here: here ? { number: here.number!, console: here.console ?? "ps4" } : null,
    ps5: stations.filter((i) => i.console === "ps5").map((i) => i.number!),
    ps4: stations.filter((i) => i.console !== "ps5").map((i) => i.number!),
  };
}

const list = (ns: number[]) => ns.map((n) => fa(n)).join("، ");

/**
 * «چالش دستهٔ گیم‌نت»: the station's TV (canvas) and its controller (buttons). The result card
 * introduces the gaming center's stations — from the live layout and machine info, so whatever the
 * manager changes in the editor is what players are told.
 */
export default function ControllerGame({ paused, difficulty, onHud, onEnd }: MiniGameProps) {
  const sim = useRef<ControllerState>(createController(difficulty));
  const hud = useHudThrottle(onHud);
  const pausedRef = useRef(paused);
  const ended = useRef(false);
  const [ctx] = useState(() => stationContext(worldStore.get().miniGameFrom));
  const ps5 = ctx.here?.console === "ps5";
  const [lit, setLit] = useState<Btn | null>(null);
  useEffect(() => exposeForTests(sim.current), []);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const hit = (b: Btn) => {
    if (pausedRef.current || ended.current) return;
    setLit(b);
    const r = press(sim.current, b);
    if (r === "hit") audio.padHit(sim.current.combo);
    else if (r === "miss") audio.padMiss();
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const b = KEYS[e.key.toLowerCase()];
      if (!b || e.repeat) return;
      e.preventDefault();
      hit(b);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  });

  useEffect(() => {
    if (!lit) return;
    const t = window.setTimeout(() => setLit(null), 140);
    return () => window.clearTimeout(t);
  }, [lit]);

  const canvas = useCanvasLoop((g, w, h, dt) => {
    const s = sim.current;
    if (!pausedRef.current && !ended.current) {
      const before = s.misses;
      step(s, dt);
      if (s.misses > before && s.last && !s.last.ok) audio.padMiss();
    }
    hud([
      { label: "زمان", value: formatTime(s.left), warn: s.left < 10 },
      { label: "امتیاز", value: fa(s.score) },
      { label: "جان", value: "❤️".repeat(Math.max(0, s.lives)) || "—", warn: s.lives <= 1 },
      { label: "زنجیره", value: `${fa(s.combo)} ×${fa(multiplier(s.combo), 1)}` },
    ]);
    draw(g, w, h, s, ctx.here, pausedRef.current);
    if (s.over && !ended.current) {
      ended.current = true;
      finish();
    }
  });

  function finish() {
    const s = sim.current;
    const machine = getMachine(ps5 ? "gc-ps5" : "gc-ps4");
    const lines = [
      `✅ ${fa(s.hits)} ضربهٔ درست — بیشترین زنجیره ${fa(s.bestCombo)}${Number.isFinite(s.fastest) ? ` — سریع‌ترین ${fa(s.fastest, 2)} ثانیه` : ""}`,
      ctx.here ? `🎮 این سیستم: سیستم ${fa(ctx.here.number)} — ${ps5 ? "پلی‌استیشن ۵" : "پلی‌استیشن ۴"}` : "🎮 سیستم‌های گیم‌نت اتم با دستهٔ پلی‌استیشن بازی می‌شوند.",
      `🏢 گیم‌نت اتم: ${fa(ctx.ps5.length + ctx.ps4.length)} سیستم${ctx.ps5.length ? ` — پلی‌استیشن ۵: سیستم ${list(ctx.ps5)}` : ""}${ctx.ps4.length ? ` — پلی‌استیشن ۴: سیستم‌های ${list(ctx.ps4)}` : ""}`,
      `💰 تعرفه: ${machine?.price ?? "هنوز در سایت ثبت نشده است"}`,
      `📍 راه رسیدن: درِ زیر تابلوی «${slotText("building-sign")}» و پله‌ها پایین؛ پیشخوان سمت راست است.`,
    ];
    onEnd({
      won: s.hits >= 15,
      headline: s.lives <= 0 ? "جان‌ها تمام شد!" : s.hits >= 15 ? "آفرین، دست گرمی داری! 🎮" : "وقت تمام شد!",
      lines,
      score: s.score,
      detail: `${fa(s.hits)} درست · زنجیره ${fa(s.bestCombo)} (${DIFF[s.difficulty]})`,
      stats: { score: s.score, hits: s.hits, bestCombo: s.bestCombo, misses: s.misses, hard: s.difficulty === "hard" },
    });
  }

  const button = (b: Btn, cls: string) => (
    <button
      key={b}
      type="button"
      className={`${styles.padBtn} ${cls} ${lit === b ? styles.padLit : ""}`}
      style={{ color: COLOR[b] }}
      aria-label={NAME[b]}
      onPointerDown={(e) => {
        e.preventDefault();
        hit(b);
      }}
      // keyboard users (Enter / Space on a focused button); pointer presses are handled above
      onClick={(e) => e.detail === 0 && hit(b)}
    >
      {GLYPH[b]}
    </button>
  );

  return (
    <div className={styles.padGame}>
      <div className={styles.padScreen}>
        <canvas ref={canvas} role="img" aria-label="تلویزیون سیستم: نشانه‌ای که باید زده شود" />
      </div>
      <div className={`${styles.pad} ${ps5 ? styles.padPs5 : ""}`} dir="ltr" role="group" aria-label="دستهٔ بازی">
        <div className={styles.dpad}>{DPAD.map((b) => button(b, styles[`at_${b}`]))}</div>
        <div className={styles.padMid} aria-hidden>
          <span>{ps5 ? "PS5" : "PS4"}</span>
          {ctx.here && <small>سیستم {fa(ctx.here.number)}</small>}
        </div>
        <div className={styles.face}>{FACE.map((b) => button(b, styles[`at_${b}`]))}</div>
      </div>
    </div>
  );
}

function draw(g: CanvasRenderingContext2D, w: number, h: number, s: ControllerState, here: { number: number; console: string } | null, paused: boolean) {
  g.fillStyle = "#101315";
  g.fillRect(0, 0, w, h);
  // the TV on its cabinet
  const tw = Math.min(w * 0.92, (h - 16) * (16 / 9) * 0.95);
  const th = (tw * 9) / 16;
  const x = (w - tw) / 2;
  const y = Math.max(8, (h - th) / 2 - 6);
  g.fillStyle = "#050506";
  roundRect(g, x - 8, y - 8, tw + 16, th + 16, 10);
  g.fill();
  const grad = g.createLinearGradient(0, y, 0, y + th);
  grad.addColorStop(0, "#14212d");
  grad.addColorStop(1, "#0a1118");
  g.fillStyle = grad;
  g.fillRect(x, y, tw, th);

  // miss flash
  if (s.last && !s.last.ok && s.last.t < 0.3) {
    g.fillStyle = `rgba(255,60,70,${0.35 * (1 - s.last.t / 0.3)})`;
    g.fillRect(x, y, tw, th);
  }

  const u = Math.min(tw, th * 1.6) / 10;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.font = `600 ${Math.round(u * 0.45)}px Vazirmatn, Tahoma, sans-serif`;
  g.fillText(`ATOM GAME${here ? ` · ${here.number} · ${here.console.toUpperCase()}` : ""}`, x + tw / 2, y + u * 0.55);

  const cx = x + tw / 2;
  const cy = y + th / 2 + u * 0.15;
  const r = Math.min(th * 0.3, u * 2.4);
  if (s.prompt && !paused) {
    const left = 1 - s.age / s.window;
    g.lineWidth = Math.max(4, u * 0.22);
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.beginPath();
    g.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = left < 0.3 ? "#ff5a5f" : "#39ff88";
    g.beginPath();
    g.arc(cx, cy, r * 1.25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
    g.stroke();
    symbol(g, s.prompt, cx, cy, r * 0.8, COLOR[s.prompt]);
  } else if (!s.over) {
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.font = `500 ${Math.round(u * 0.6)}px Vazirmatn, Tahoma, sans-serif`;
    g.fillText(paused ? "توقف" : "آماده…", cx, cy);
  }

  // +points / combo
  if (s.last?.ok && s.last.t < 0.6) {
    g.globalAlpha = 1 - s.last.t / 0.6;
    g.fillStyle = "#39ff88";
    g.font = `800 ${Math.round(u * 0.8)}px Vazirmatn, Tahoma, sans-serif`;
    g.direction = "ltr"; // "+۳۰", not "۳۰+"
    g.fillText(`+${fa(s.last.points)}`, cx + r * 1.9, cy - r * 0.9 - s.last.t * u * 2);
    g.direction = "inherit";
    g.globalAlpha = 1;
  }
  if (s.combo >= 5) {
    g.fillStyle = "#ffcf3d";
    g.font = `700 ${Math.round(u * 0.5)}px Vazirmatn, Tahoma, sans-serif`;
    g.fillText(`زنجیرهٔ ${fa(s.combo)} — ×${fa(multiplier(s.combo), 1)}`, cx, y + th - u * 0.6);
  }
}

function symbol(g: CanvasRenderingContext2D, b: Btn, x: number, y: number, r: number, color: string) {
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(5, r * 0.18);
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  switch (b) {
    case "triangle":
      g.moveTo(x, y - r);
      g.lineTo(x + r * 0.95, y + r * 0.7);
      g.lineTo(x - r * 0.95, y + r * 0.7);
      g.closePath();
      g.stroke();
      return;
    case "circle":
      g.arc(x, y, r * 0.85, 0, Math.PI * 2);
      g.stroke();
      return;
    case "cross":
      g.moveTo(x - r * 0.75, y - r * 0.75);
      g.lineTo(x + r * 0.75, y + r * 0.75);
      g.moveTo(x + r * 0.75, y - r * 0.75);
      g.lineTo(x - r * 0.75, y + r * 0.75);
      g.stroke();
      return;
    case "square":
      g.rect(x - r * 0.72, y - r * 0.72, r * 1.44, r * 1.44);
      g.stroke();
      return;
    default: {
      const a = { up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI }[b];
      g.save();
      g.translate(x, y);
      g.rotate(a);
      g.moveTo(r * 0.9, 0);
      g.lineTo(-r * 0.5, -r * 0.75);
      g.lineTo(-r * 0.5, r * 0.75);
      g.closePath();
      g.fill();
      g.restore();
    }
  }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
