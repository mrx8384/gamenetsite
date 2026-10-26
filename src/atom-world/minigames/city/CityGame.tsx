"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { characters } from "../../data/characters";
import { useWorld, worldStore } from "../../store";
import { audio } from "../../systems/AudioManager";
import { QUALITY_PRESETS } from "../../systems/QualityManager";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import { VirtualStick } from "../VirtualStick";
import { type BlockKind, blockKinds, pageFont } from "./city3d";
import { CityScene, type CityView } from "./CityScene";
import { block, type CityInput, type CityState, createCity, N, SIZE, stepCity } from "./engine";

const DIFF: Record<string, string> = { easy: "آسان", normal: "معمولی", hard: "سخت" };

/**
 * «شهر اتم» in 3D (GTA-style, no violence): a chase camera behind the player or their car, the
 * taxi job as a beam of light, and an overlay with the job, messages and a mini-map that turns with
 * the camera. On foot the controls follow the camera (up = forward); in a car, up = throttle and
 * left / right = steering. Touch: joystick + «سوار شو / پیاده شو» + handbrake; keys: arrows / WASD,
 * E or Enter, Space.
 */
export default function CityGame({ paused, difficulty, onHud, onEnd }: MiniGameProps) {
  const [initial] = useState(() => createCity(difficulty));
  const sim = useRef<CityState>(initial);
  const [kinds] = useState(() => blockKinds(initial));
  const view = useRef<CityView>({ yaw: initial.player.heading, snap: true });
  const quality = useWorld((s) => s.quality);
  const preset = QUALITY_PRESETS[quality];
  const [playerColor] = useState(() => characters[worldStore.get().character]?.look.jacket ?? "#1f2937");
  const hud = useHudThrottle(onHud);
  const keys = useRef(new Set<string>());
  const stick = useRef({ x: 0, y: 0 });
  const action = useRef(false);
  const hand = useRef(false);
  const pausedRef = useRef(paused);
  const ended = useRef(false);
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [inCar, setInCar] = useState(false);
  const last = useRef({ money: 0, crashes: 0, deliveries: 0 });
  useEffect(() => exposeForTests(sim.current), []);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "e" || k === "enter") {
        e.preventDefault();
        if (!e.repeat) action.current = true;
        return;
      }
      if (k === " " || k.startsWith("arrow")) e.preventDefault();
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

  /** One game step (called by the 3D scene every frame, before it draws). */
  const tick = (dt: number) => {
    const s = sim.current;
    if (!pausedRef.current && !ended.current) {
      const k = keys.current;
      const ax = (pos: string[], neg: string[]) => (pos.some((p) => k.has(p)) ? 1 : 0) - (neg.some((n) => k.has(n)) ? 1 : 0);
      let x = clamp1(ax(["arrowright", "d"], ["arrowleft", "a"]) + stick.current.x);
      let y = clamp1(ax(["arrowup", "w"], ["arrowdown", "s"]) + stick.current.y);
      if (s.player.car === null) {
        // on foot: up = where the camera looks, right = the camera's right
        const fx = Math.cos(view.current.yaw);
        const fy = Math.sin(view.current.yaw);
        const mx = y * fx - x * fy;
        const my = y * fy + x * fx;
        x = mx;
        y = -my;
      }
      const input: CityInput = { x, y, handbrake: k.has(" ") || hand.current, action: action.current };
      action.current = false;
      stepCity(s, dt, input);
      const l = last.current;
      if (s.deliveries > l.deliveries) audio.goal(true);
      else if (s.money > l.money) audio.click();
      if (s.crashes > l.crashes) audio.hockeyWall(4);
      Object.assign(l, { money: s.money, crashes: s.crashes, deliveries: s.deliveries });
      const now = s.player.car !== null;
      if (now !== inCar) setInCar(now);
    }
    const car = s.player.car !== null ? s.cars.find((c) => c.id === s.player.car)! : null;
    hud([
      { label: "زمان", value: formatTime(s.left), warn: s.left < 20 },
      { label: "پول", value: `${fa(s.money)} 💰` },
      { label: "مسافر", value: fa(s.deliveries) },
      ...(car ? [{ label: "ماشین", value: `${fa(Math.round(car.health))}٪`, warn: car.health < 30 }] : []),
    ]);
    if (s.over && !ended.current) {
      ended.current = true;
      onEnd({
        won: s.deliveries >= 3,
        headline: s.deliveries >= 3 ? "رانندهٔ نمونهٔ شهر اتم! 🚕" : "وقت تمام شد!",
        lines: [
          `🚕 ${fa(s.deliveries)} مسافر رساندید — 🪙 ${fa(s.coinsTaken)} سکه`,
          `💰 درآمد: ${fa(s.money)}`,
          `💥 ${fa(s.crashes)} تصادف${s.crashes === 0 ? " — بی‌نقص!" : ""}`,
          "🎮 این بازی نمایشی است؛ برای بازی‌های واقعی به گیم‌نت اتم سر بزنید.",
        ],
        score: s.money,
        detail: `${fa(s.deliveries)} مسافر · ${fa(s.money)} (${DIFF[s.difficulty]})`,
        stats: { money: s.money, deliveries: s.deliveries, crashes: s.crashes, coins: s.coinsTaken },
      });
    }
  };
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });

  // the job banner, messages and the mini-map, drawn over the 3D view
  const overlay = useCanvasLoop((g, w, h) => {
    g.clearRect(0, 0, w, h);
    drawOverlay(g, w, h, sim.current, kinds, view.current.yaw);
  });

  const setStick = (x: number, y: number) => {
    stick.current = { x, y };
  };

  return (
    <div className={`${styles.digLayout} ${touch ? styles.digTouch : ""}`}>
      <div className={styles.canvasBox} role="img" aria-label="شهر اتم سه‌بعدی: شما، ماشین‌ها و مقصد">
        <Canvas
          flat
          dpr={[1, preset.maxDpr]}
          gl={{ antialias: preset.antialias, powerPreference: "high-performance", stencil: false }}
          camera={{ fov: 60, near: 0.3, far: 170, position: [initial.player.x, 3, initial.player.y + 6] }}
          style={{ position: "absolute", inset: 0, touchAction: "none" }}
        >
          <CityScene city={initial} simRef={sim} tickRef={tickRef} viewRef={view} texPx={2048} playerColor={playerColor} />
        </Canvas>
        <canvas ref={overlay} aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      </div>
      {touch && (
        <>
          <div className={styles.padLeft}>
            <VirtualStick label={inCar ? "فرمان و گاز" : "راه رفتن"} up={inCar ? "گاز" : "جلو"} down={inCar ? "ترمز" : "عقب"} left="◀" right="▶" onChange={setStick} />
          </div>
          <div className={styles.padRight} style={{ flexDirection: "column", gap: "0.5rem", alignItems: "flex-end", justifyContent: "flex-end" }}>
            {inCar && (
              <button
                type="button"
                className={styles.cityBtn}
                onPointerDown={() => (hand.current = true)}
                onPointerUp={() => (hand.current = false)}
                onPointerCancel={() => (hand.current = false)}
                onPointerLeave={() => (hand.current = false)}
              >
                ✋ ترمز دستی
              </button>
            )}
            <button type="button" className={`${styles.cityBtn} ${styles.cityBtnMain}`} onClick={() => (action.current = true)}>
              {inCar ? "🚪 پیاده شو" : "🚕 سوار شو"}
            </button>
          </div>
        </>
      )}
      {!touch && (
        <button type="button" className={`${styles.cityBtn} ${styles.cityBtnMain} ${styles.cityKeyBtn}`} onClick={() => (action.current = true)}>
          {inCar ? "🚪 پیاده شو (E)" : "🚕 سوار شو (E)"}
        </button>
      )}
    </div>
  );
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Job banner (top), latest message (bottom) and a round mini-map that turns with the camera. */
function drawOverlay(g: CanvasRenderingContext2D, w: number, h: number, s: CityState, kinds: BlockKind[][], yaw: number) {
  const font = pageFont();
  const m = s.mission;
  const target = m ? (m.stage === "pickup" ? m.pickup : m.dest) : null;
  const p = s.player;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.direction = "rtl";
  if (m && target) {
    const d = Math.round(Math.hypot(target.x - p.x, target.y - p.y));
    const secs = fa(Math.max(0, Math.ceil(m.timeLeft)));
    const txt = m.stage === "pickup" ? `🧍 مسافر منتظر است — ${fa(d)} متر — ${secs} ثانیه` : `📍 ببرید به «${m.dest.name}» — ${fa(d)} متر — ${secs} ثانیه`;
    g.font = `700 ${w < 420 ? 13 : 15}px ${font}`;
    const tw = Math.min(w - 16, g.measureText(txt).width + 24);
    g.fillStyle = "rgba(5,6,5,0.75)";
    g.beginPath();
    g.roundRect(w / 2 - tw / 2, 8, tw, 30, 15);
    g.fill();
    g.fillStyle = m.stage === "pickup" ? "#39ff88" : "#ff8fc4";
    g.fillText(txt, w / 2, 23, tw - 16);
  }
  if (s.note && s.time - s.note.t < 3.5) {
    g.globalAlpha = Math.min(1, 3.5 - (s.time - s.note.t));
    g.font = `600 14px ${font}`;
    const tw = Math.min(w - 16, g.measureText(s.note.text).width + 24);
    g.fillStyle = "rgba(5,6,5,0.8)";
    g.beginPath();
    g.roundRect(w / 2 - tw / 2, h - 46, tw, 30, 15);
    g.fill();
    g.fillStyle = "#fff";
    g.fillText(s.note.text, w / 2, h - 31, tw - 16);
    g.globalAlpha = 1;
  }

  // round mini-map: the camera's forward is up, 55 m around the player
  const R = Math.max(42, Math.min(64, w * 0.13));
  const cx = 12 + R;
  const cy = 48 + R;
  const k = R / 55;
  const turn = -Math.PI / 2 - yaw;
  g.save();
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fillStyle = "#4f7340";
  g.fill();
  g.clip();
  g.translate(cx, cy);
  g.rotate(turn);
  g.scale(k, k);
  g.translate(-p.x, -p.y);
  g.fillStyle = "#43474d";
  g.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const b = block(i, j);
      const kind = kinds[i][j];
      g.fillStyle = kind === "club" ? "#39ff88" : kind === "park" ? "#5f8f4a" : kind === "parking" ? "#7a7d82" : "#a49f93";
      g.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    }
  g.restore();
  // the job's place (kept on the edge when it is far)
  if (m && target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    let rx = (dx * Math.cos(turn) - dy * Math.sin(turn)) * k;
    let ry = (dx * Math.sin(turn) + dy * Math.cos(turn)) * k;
    const len = Math.hypot(rx, ry);
    if (len > R - 6) {
      rx *= (R - 6) / len;
      ry *= (R - 6) / len;
    }
    g.fillStyle = m.stage === "pickup" ? "#39ff88" : "#ff4fa3";
    g.strokeStyle = "#050605";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx + rx, cy + ry, 5 + Math.sin(s.time * 5), 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  // rim, north mark, the player
  g.strokeStyle = "rgba(5,6,5,0.85)";
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.stroke();
  const na = turn - Math.PI / 2;
  g.fillStyle = "#fff";
  g.font = `800 11px ${font}`;
  g.fillText("N", cx + Math.cos(na) * (R - 9), cy + Math.sin(na) * (R - 9));
  g.save();
  g.translate(cx, cy);
  g.rotate(p.heading - yaw - Math.PI / 2);
  g.fillStyle = "#ffffff";
  g.strokeStyle = "#050605";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(8, 0);
  g.lineTo(-6, -6);
  g.lineTo(-3, 0);
  g.lineTo(-6, 6);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}
