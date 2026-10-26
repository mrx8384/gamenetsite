"use client";

import { useEffect, useRef, useState } from "react";
import { audio } from "../../systems/AudioManager";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import { VirtualStick } from "../VirtualStick";
import { armPose, BUCKET_CAP, type Controls, createExcavator, type ExcavatorState, SCENE, stepExcavator, swing, TRUCK } from "./engine";

const YELLOW = "#f6b21a";
const ORANGE = "#f07a12";
const VIEW = { y0: -1.05, y1: 4.6 };

/**
 * RC-excavator mini-game, side view of the club's sand area: soil pile on the right, dump truck on
 * the left. Joysticks on touch screens, keys on desktop. Models are temporary (simplified toys).
 */
export default function ExcavatorGame({ paused, onHud, onEnd }: MiniGameProps) {
  const sim = useRef<ExcavatorState>(createExcavator());
  const hud = useHudThrottle(onHud);
  const keys = useRef(new Set<string>());
  const sticks = useRef({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [msg, setMsg] = useState<string | null>(null);
  const sfx = useRef({ dig: 0, pour: 0, blocked: 0 });
  const ended = useRef(false);
  const pausedRef = useRef(paused);
  useEffect(() => exposeForTests(sim.current), []);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "q" || k === "e") {
        e.preventDefault();
        if (!e.repeat && !pausedRef.current) trySwing();
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

  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 1600);
    return () => window.clearTimeout(t);
  }, [msg]);

  function trySwing() {
    swing(sim.current);
  }

  const canvas = useCanvasLoop((ctx, w, h, dt) => {
    const s = sim.current;
    if (!pausedRef.current && !ended.current) {
      const k = keys.current;
      const axis = (pos: string[], neg: string[]) => (pos.some((p) => k.has(p)) ? 1 : 0) - (neg.some((n) => k.has(n)) ? 1 : 0);
      const st = sticks.current;
      const c: Controls = {
        drive: clamp1(axis(["d"], ["a"]) + st.left.x),
        stick: clamp1(axis(["w"], ["s"]) + st.left.y),
        boom: clamp1(axis(["arrowup"], ["arrowdown"]) + st.right.y),
        bucket: clamp1(axis(["arrowright"], ["arrowleft"]) + st.right.x),
      };
      const fx = sfx.current;
      fx.dig -= dt;
      fx.pour -= dt;
      fx.blocked -= dt;
      for (const e of stepExcavator(s, c, dt)) {
        if (e.type === "dig" && fx.dig <= 0) {
          audio.dig();
          fx.dig = 0.18;
        } else if (e.type === "pour" && fx.pour <= 0) {
          audio.pour();
          fx.pour = 0.22;
        } else if (e.type === "blocked" && fx.blocked <= 0 && (c.boom || c.stick || c.bucket || c.drive)) {
          audio.blocked();
          fx.blocked = 0.5;
        } else if (e.type === "swingStart") {
          audio.blocked();
        } else if (e.type === "swingBlocked") {
          setMsg("این‌جا جای چرخیدن نیست؛ کمی جلو یا عقب بروید");
        } else if (e.type === "truckFull") {
          audio.truckHorn();
          setMsg(`کامیون پر شد! +${fa(50)} امتیاز`);
        }
      }
      if (s.over) {
        ended.current = true;
        const score = Math.round(s.score);
        onEnd({
          won: score > 0,
          headline: score > 0 ? `⏱️ وقت تمام شد — ${fa(score)} امتیاز` : "وقت تمام شد",
          lines: [
            `کامیون‌های پرشده: ${fa(s.trucksFilled)}`,
            `خاک جابه‌جاشده: ${fa(Math.round((s.delivered / BUCKET_CAP) * 10) / 10, 1)} جام`,
            score > 0 ? "برای امتیاز بیشتر، جام را پر کنید و کمتر خاک بریزید." : "جام را در تپه فرو کنید، با ← جمعش کنید، بعد بچرخید و روی کامیون با → خالی کنید.",
          ],
          score,
          detail: `${fa(s.trucksFilled)} کامیون`,
          stats: { trucks: s.trucksFilled, delivered: Math.round(s.delivered * 100) / 100, score },
        });
      }
    }
    hud([
      { label: "زمان", value: formatTime(s.timeLeft), warn: s.timeLeft < 15 },
      { label: "امتیاز", value: fa(Math.round(s.score)) },
      { label: "جام", value: `${fa(Math.round((s.load / BUCKET_CAP) * 100))}٪` },
      { label: "کامیون", value: s.truckAway > 0 ? "در راه" : `${fa(Math.round((s.truckLoad / TRUCK.cap) * 100))}٪` },
    ]);
    draw(ctx, w, h, s);
  });

  const setStick = (side: "left" | "right") => (x: number, y: number) => {
    sticks.current[side] = { x, y };
  };

  return (
    <div className={`${styles.digLayout} ${touch ? styles.digTouch : ""}`}>
      <div className={styles.canvasBox}>
        <canvas ref={canvas} className={styles.canvas} role="img" aria-label="محوطهٔ خاکی با بیل مکانیکی، تپهٔ خاک در سمت راست و کامیون در سمت چپ" />
        {msg && (
          <div className={styles.flash} role="status">
            {msg}
          </div>
        )}
      </div>
      {touch && (
        <>
          <p className={styles.rotateHint}>برای دید بهتر، گوشی را افقی بگیرید.</p>
          <div className={styles.padLeft}>
            <VirtualStick label="دستهٔ چپ" up="باز" down="بسته" left="◀ حرکت" right="حرکت ▶" onChange={setStick("left")} />
          </div>
          <div className={styles.padRight}>
            <VirtualStick label="دستهٔ راست" up="بوم ▲" down="بوم ▼" left="جمع" right="خالی" onChange={setStick("right")} />
          </div>
        </>
      )}
      <button type="button" className={`${styles.swingBtn} ${touch ? styles.swingBtnTouch : ""}`} onClick={trySwing} aria-label="چرخش کابین به سمت دیگر">
        🔄 چرخش
      </button>
    </div>
  );
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** Scene → canvas drawing. */
function draw(ctx: CanvasRenderingContext2D, w: number, h: number, s: ExcavatorState) {
  const scale = Math.min(w / SCENE.width, h / (VIEW.y1 - VIEW.y0));
  const ox = (w - SCENE.width * scale) / 2;
  // sit on the bottom edge (next to the joysticks on phones)
  const oy = h;
  const X = (x: number) => ox + x * scale;
  const Y = (y: number) => oy - (y - VIEW.y0) * scale;
  ctx.clearRect(0, 0, w, h);

  // dark wall of the RC room
  const g = ctx.createLinearGradient(0, Y(VIEW.y1), 0, Y(0));
  g.addColorStop(0, "#1b1f22");
  g.addColorStop(1, "#2a2f33");
  ctx.fillStyle = g;
  ctx.fillRect(X(0), Y(VIEW.y1), SCENE.width * scale, (VIEW.y1 - VIEW.y0) * scale);
  // neon strip
  ctx.fillStyle = "#39ff88";
  ctx.shadowColor = "#39ff88";
  ctx.shadowBlur = 12;
  ctx.fillRect(X(0), Y(4.45), SCENE.width * scale, 0.04 * scale);
  ctx.shadowBlur = 0;

  // soil height field
  ctx.fillStyle = "#3a2a1c";
  ctx.fillRect(X(0), Y(SCENE.bedrock), SCENE.width * scale, (SCENE.bedrock - VIEW.y0) * scale + 2);
  ctx.beginPath();
  ctx.moveTo(X(0), Y(SCENE.bedrock));
  s.heights.forEach((hgt, i) => ctx.lineTo(X((i + 0.5) * SCENE.col), Y(hgt)));
  ctx.lineTo(X(SCENE.width), Y(SCENE.bedrock));
  ctx.closePath();
  const sg = ctx.createLinearGradient(0, Y(1.4), 0, Y(SCENE.bedrock));
  sg.addColorStop(0, "#c89a63");
  sg.addColorStop(1, "#8a6239");
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = "#e0b47a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  s.heights.forEach((hgt, i) => (i ? ctx.lineTo(X((i + 0.5) * SCENE.col), Y(hgt)) : ctx.moveTo(X(0.05), Y(hgt))));
  ctx.stroke();

  drawTruck(ctx, s, X, Y, scale);
  drawExcavator(ctx, s, X, Y, scale);

  // falling soil
  ctx.fillStyle = "#c89a63";
  for (const gr of s.grains) ctx.fillRect(X(gr.x) - 2, Y(gr.y) - 2, 4, 4);
}

const OUTLINE = "#1a1206";

function drawTruck(ctx: CanvasRenderingContext2D, s: ExcavatorState, X: (x: number) => number, Y: (y: number) => number, scale: number) {
  // leaving (first half) / arriving (second half) from the left edge
  const t = s.truckAway;
  const off = t === 0 ? 0 : t > 1.5 ? -((3 - t) / 1.5) * 5 : -(t / 1.5) * 5;
  const x0 = TRUCK.x0 + off;
  const x1 = TRUCK.x1 + off;
  const poly = (pts: [number, number][], fill: string, stroke = true) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = Math.max(1, scale * 0.025);
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  };
  // chassis
  poly([[x0 - 0.62, 0.42], [x1 + 0.05, 0.42], [x1 + 0.05, 0.72], [x0 - 0.62, 0.72]], "#2b2b2b");
  // cab (rounded nose, window, headlight, bumper)
  poly([[x0 - 0.6, 0.62], [x0 - 0.05, 0.62], [x0 - 0.05, 1.78], [x0 - 0.38, 1.78], [x0 - 0.6, 1.45]], ORANGE);
  poly([[x0 - 0.5, 1.18], [x0 - 0.14, 1.18], [x0 - 0.14, 1.66], [x0 - 0.36, 1.66], [x0 - 0.5, 1.42]], "#9fd6ff");
  poly([[x0 - 0.66, 0.6], [x0 - 0.52, 0.6], [x0 - 0.52, 0.8], [x0 - 0.66, 0.8]], "#d8d8d8");
  ctx.fillStyle = "#fff3a6";
  ctx.fillRect(X(x0 - 0.6), Y(0.98), 0.08 * scale, 0.1 * scale);
  // dump bed with ribs
  const fill = t === 0 ? s.truckLoad / TRUCK.cap : t > 1.5 ? 1 : 0;
  poly([[x0, TRUCK.bed - 0.28], [x1, TRUCK.bed - 0.28], [x1 + 0.08, TRUCK.wall], [x1 - 0.08, TRUCK.wall], [x1 - 0.1, TRUCK.bed], [x0 + 0.1, TRUCK.bed], [x0 + 0.08, TRUCK.wall], [x0 - 0.02, TRUCK.wall]], YELLOW);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = Math.max(1, scale * 0.03);
  for (let rx = x0 + 0.5; rx < x1 - 0.3; rx += 0.55) {
    ctx.beginPath();
    ctx.moveTo(X(rx), Y(TRUCK.bed - 0.26));
    ctx.lineTo(X(rx), Y(TRUCK.bed - 0.02));
    ctx.stroke();
  }
  if (fill > 0) {
    const top = TRUCK.bed + fill * (TRUCK.wall - TRUCK.bed - 0.05);
    ctx.fillStyle = "#c89a63";
    ctx.beginPath();
    ctx.moveTo(X(x0 + 0.1), Y(TRUCK.bed));
    ctx.lineTo(X(x0 + 0.1), Y(top));
    ctx.quadraticCurveTo(X((x0 + x1) / 2), Y(top + 0.25 * fill), X(x1 - 0.1), Y(top));
    ctx.lineTo(X(x1 - 0.1), Y(TRUCK.bed));
    ctx.fill();
  }
  // wheels with hubs
  for (const wx of [x0 - 0.25, x0 + 0.75, x1 - 0.45]) {
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(X(wx), Y(0.33), 0.32 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8a8f94";
    ctx.beginPath();
    ctx.arc(X(wx), Y(0.33), 0.15 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(X(wx), Y(0.33), 0.05 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExcavator(ctx: CanvasRenderingContext2D, s: ExcavatorState, X: (x: number) => number, Y: (y: number) => number, scale: number) {
  // seen from the side, a turning cab looks like its arm shortens and comes back on the other side
  const f = -s.facing * Math.cos(Math.PI * s.swingT);
  const bx = s.baseX;
  const lw = Math.max(1, scale * 0.025);
  /** polygon in the machine's local frame (x forward, y up), mirrored by the swing */
  const local = (pts: [number, number][], fill: string, stroke = true) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(bx + f * x), Y(y)) : ctx.moveTo(X(bx + f * x), Y(y))));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
  };
  const segment = (ax: number, ay: number, bx2: number, by: number, w0: number, w1: number, fill: string) => {
    // tapered beam between two scene points
    const dx = bx2 - ax;
    const dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    ctx.beginPath();
    ctx.moveTo(X(ax + nx * w0), Y(ay + ny * w0));
    ctx.lineTo(X(bx2 + nx * w1), Y(by + ny * w1));
    ctx.lineTo(X(bx2 - nx * w1), Y(by - ny * w1));
    ctx.lineTo(X(ax - nx * w0), Y(ay - ny * w0));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  };
  const cylinder = (ax: number, ay: number, bx2: number, by: number) => {
    // hydraulic ram: thick grey barrel + chrome rod
    const mx = ax + (bx2 - ax) * 0.55;
    const my = ay + (by - ay) * 0.55;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#4a4f55";
    ctx.lineWidth = 0.13 * scale;
    ctx.beginPath();
    ctx.moveTo(X(ax), Y(ay));
    ctx.lineTo(X(mx), Y(my));
    ctx.stroke();
    ctx.strokeStyle = "#e6e9ec";
    ctx.lineWidth = 0.06 * scale;
    ctx.beginPath();
    ctx.moveTo(X(mx), Y(my));
    ctx.lineTo(X(bx2), Y(by));
    ctx.stroke();
    ctx.lineCap = "butt";
  };

  // tracks: rounded belt with treads, rollers, sprocket and idler
  ctx.fillStyle = "#1d1d1d";
  roundRect(ctx, X(bx - 1.28), Y(0.64), 2.56 * scale, 0.64 * scale, 0.32 * scale);
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.fillStyle = "#3a3a3a";
  const tread = 0.18;
  const shift = (bx * 3) % tread; // treads move with the machine
  for (let tx = -1.1 - shift; tx < 1.15; tx += tread) ctx.fillRect(X(bx + tx), Y(0.64), Math.max(1, 0.06 * scale), 0.07 * scale);
  for (const wx of [-0.95, -0.45, 0, 0.45, 0.95]) {
    const big = Math.abs(wx) > 0.9;
    ctx.fillStyle = big ? "#6b6f74" : "#55595e";
    ctx.beginPath();
    ctx.arc(X(bx + wx), Y(0.32), (big ? 0.22 : 0.14) * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(X(bx + wx), Y(0.32), 0.05 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // swing ring
  local([[-0.7, 0.64], [0.7, 0.64], [0.6, 0.74], [-0.6, 0.74]], "#2d2d2d");
  // counterweight (behind) with hazard stripes
  local([[-1.3, 0.74], [-0.55, 0.74], [-0.55, 1.3], [-1.18, 1.3], [-1.3, 1.18]], "#2f2f2f");
  for (let k = 0; k < 3; k++) local([[-1.26 + k * 0.22, 0.78], [-1.16 + k * 0.22, 0.78], [-1.24 + k * 0.22, 0.98], [-1.3 + k * 0.22, 0.98]], YELLOW, false);
  // engine housing + exhaust
  local([[-1.15, 0.74], [0.95, 0.74], [0.95, 1.24], [-1.15, 1.32]], YELLOW);
  local([[-0.55, 1.3], [-0.47, 1.3], [-0.47, 1.62], [-0.55, 1.62]], "#3a3a3a");
  // cab with window frame
  local([[-0.15, 1.24], [0.82, 1.24], [0.82, 2.0], [0.12, 2.16], [-0.15, 2.16]], YELLOW);
  local([[-0.04, 1.42], [0.7, 1.42], [0.7, 1.92], [0.12, 2.04], [-0.04, 2.04]], "#9fd6ff");
  local([[0.3, 1.42], [0.36, 1.42], [0.36, 2.0], [0.3, 2.0]], "#2d2d2d", false);
  // "RC" plate (toy model)
  ctx.save();
  ctx.fillStyle = "#1d1d1d";
  ctx.font = `bold ${Math.max(8, 0.2 * scale)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (Math.abs(f) > 0.4) ctx.fillText("ATOM", X(bx + f * -0.3), Y(0.99));
  ctx.restore();

  const p = armPose({ baseX: s.baseX, facing: f, boom: s.boom, stick: s.stick, bucket: s.bucket });
  // boom cylinder from the body to the middle of the boom
  const bm = { x: p.pivot.x + (p.elbow.x - p.pivot.x) * 0.45, y: p.pivot.y + (p.elbow.y - p.pivot.y) * 0.45 - 0.12 };
  cylinder(bx + f * 0.7, 0.98, bm.x, bm.y);
  // boom and stick (tapered)
  segment(p.pivot.x, p.pivot.y, p.elbow.x, p.elbow.y, 0.17, 0.12, ORANGE);
  segment(p.elbow.x, p.elbow.y, p.wrist.x, p.wrist.y, 0.11, 0.07, ORANGE);
  // bucket cylinder along the stick
  cylinder(p.elbow.x + (p.wrist.x - p.elbow.x) * 0.2, p.elbow.y + (p.wrist.y - p.elbow.y) * 0.2 + 0.08, p.elbow.x + (p.wrist.x - p.elbow.x) * 0.88, p.elbow.y + (p.wrist.y - p.elbow.y) * 0.88 + 0.08);

  // bucket: curved cup from the wrist to the cutting edge, with teeth
  const dx = p.tip.x - p.wrist.x;
  const dy = p.tip.y - p.wrist.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (dy / len) * Math.sign(f || 1);
  const ny = (-dx / len) * Math.sign(f || 1);
  const back = { x: p.wrist.x - nx * 0.46 + dx * 0.55, y: p.wrist.y - ny * 0.46 + dy * 0.55 };
  ctx.fillStyle = "#3b3f42";
  ctx.beginPath();
  ctx.moveTo(X(p.wrist.x), Y(p.wrist.y));
  ctx.quadraticCurveTo(X(back.x), Y(back.y), X(p.tip.x), Y(p.tip.y));
  ctx.lineTo(X(p.wrist.x + nx * 0.08), Y(p.wrist.y + ny * 0.08));
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // teeth at the cutting edge
  ctx.fillStyle = "#c9ccd0";
  for (const k of [-0.05, 0.05]) {
    const tx = p.tip.x + (dx / len) * 0.1 + nx * k;
    const ty = p.tip.y + (dy / len) * 0.1 + ny * k;
    ctx.beginPath();
    ctx.moveTo(X(p.tip.x + nx * (k - 0.035)), Y(p.tip.y + ny * (k - 0.035)));
    ctx.lineTo(X(tx), Y(ty));
    ctx.lineTo(X(p.tip.x + nx * (k + 0.035)), Y(p.tip.y + ny * (k + 0.035)));
    ctx.closePath();
    ctx.fill();
  }
  // load in the bucket
  if (s.load > 0.005) {
    ctx.fillStyle = "#c89a63";
    ctx.beginPath();
    const k = Math.min(1, s.load / BUCKET_CAP);
    ctx.arc(X((p.wrist.x + p.tip.x) / 2 + nx * 0.05), Y((p.wrist.y + p.tip.y) / 2 + ny * 0.05), (0.08 + 0.17 * k) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  // pins
  for (const j of [p.pivot, p.elbow, p.wrist]) {
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(X(j.x), Y(j.y), 0.075 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9aa0a6";
    ctx.beginPath();
    ctx.arc(X(j.x), Y(j.y), 0.035 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
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
