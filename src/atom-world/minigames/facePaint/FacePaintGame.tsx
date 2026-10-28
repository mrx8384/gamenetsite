"use client";

import { useEffect, useRef, useState } from "react";
import { audio } from "../../systems/AudioManager";
import styles from "../minigames.module.css";
import { fa, formatTime, type MiniGameProps } from "../types";
import { exposeForTests, useCanvasLoop, useHudThrottle } from "../useCanvas";
import {
  BRUSHES,
  colorIndex,
  COLORS,
  type ColorId,
  createFacePaint,
  type Design,
  EYES,
  FACE,
  type FacePaintState,
  finishFace,
  MOUTH,
  reaction,
  roundStats,
  stepFacePaint,
  stroke,
  totalScore,
} from "./engine";

const DIFF: Record<string, string> = { easy: "آسان", normal: "معمولی", hard: "سخت" };
/** Resolution of the paint layer (face square, px). */
const PX = 512;

/**
 * «گریم صورت» at the kids' corner: a child sits at the mirror and asks for a design (card in the
 * corner). Paint it on their face with the brush; the closer to the card, the more points.
 * Three children per round.
 */
export default function FacePaintGame({ paused, difficulty, onHud, onEnd }: MiniGameProps) {
  const sim = useRef<FacePaintState>(createFacePaint(difficulty));
  const hud = useHudThrottle(onHud);
  const pausedRef = useRef(paused);
  const ended = useRef(false);
  const [color, setColor] = useState<ColorId>("red");
  const [brush, setBrush] = useState(1);
  const [eraser, setEraser] = useState(false);
  const tool = useRef({ color, brush, eraser });
  const layer = useRef<HTMLCanvasElement | null>(null);
  const layerFor = useRef(-1);
  const box = useRef({ x: 0, y: 0, size: 1 });
  const last = useRef<[number, number] | null>(null);
  const t = useRef(0);

  useEffect(() => {
    tool.current = { color, brush, eraser };
  }, [color, brush, eraser]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  /** The visible paint (same strokes as the scoring grid, at full resolution). */
  const paintLayer = () => {
    if (!layer.current) {
      layer.current = document.createElement("canvas");
      layer.current.width = layer.current.height = PX;
    }
    const s = sim.current;
    if (layerFor.current !== s.index) {
      layer.current.getContext("2d")!.clearRect(0, 0, PX, PX);
      layerFor.current = s.index;
    }
    return layer.current;
  };

  const paint = (from: [number, number], to: [number, number]) => {
    const s = sim.current;
    const { color: c, brush: b, eraser: er } = tool.current;
    const r = BRUSHES[b].r;
    stroke(s.painted, from, to, r, er ? 0 : colorIndex(c));
    const g = paintLayer().getContext("2d")!;
    g.save();
    g.beginPath();
    g.ellipse(FACE.cx * PX, FACE.cy * PX, FACE.rx * PX, FACE.ry * PX, 0, 0, Math.PI * 2);
    g.clip();
    g.globalCompositeOperation = er ? "destination-out" : "source-over";
    g.strokeStyle = g.fillStyle = er ? "#000" : COLORS[colorIndex(c) - 1].hex;
    g.lineWidth = r * 2 * PX;
    g.lineCap = g.lineJoin = "round";
    g.beginPath();
    g.moveTo(from[0] * PX, from[1] * PX);
    g.lineTo(to[0] * PX + 0.01, to[1] * PX);
    g.stroke();
    g.restore();
  };

  const clearFace = () => {
    const s = sim.current;
    if (s.over || s.showing > 0) return;
    s.painted.fill(0);
    paintLayer().getContext("2d")!.clearRect(0, 0, PX, PX);
  };

  const done = () => {
    if (pausedRef.current || ended.current) return;
    const r = finishFace(sim.current);
    if (r) audio.result(r.percent >= 65);
  };

  // tests: paint exactly what the child asked for (?debug=1 only)
  useEffect(() => {
    const s = sim.current as FacePaintState & { paintTarget?: (part?: number) => void };
    s.paintTarget = (part = 1) => {
      const c = s.customers[s.index];
      const n = Math.floor(c.target.length * part);
      s.painted.set(c.target.subarray(0, n));
      const g = paintLayer().getContext("2d")!;
      drawDesign(g, c.design, 0, 0, PX, 1);
    };
    return exposeForTests(s);
  }, []);

  const toFace = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    const b = box.current;
    return [(e.clientX - rect.left - b.x) / b.size, (e.clientY - rect.top - b.y) / b.size];
  };
  const canPaint = () => !pausedRef.current && !ended.current && sim.current.showing <= 0 && !sim.current.over;

  const finish = () => {
    const s = sim.current;
    const st = roundStats(s);
    const lines = s.results.map((r, i) => {
      const c = s.customers[i];
      const re = reaction(r.percent);
      return `${re.emoji} ${c.name} — ${c.design.emoji} ${c.design.name}: ${fa(r.percent)}٪ شبیه (${fa(r.points)} امتیاز)`;
    });
    lines.push(`🎨 ${fa(st.colors)} رنگ به کار بردید.`);
    onEnd({
      won: st.avg >= 65,
      headline: st.avg >= 85 ? "استاد گریم! بچه‌ها عاشقش شدند 😍" : st.avg >= 65 ? "آفرین، بچه‌ها خوشحال رفتند! 🎨" : "تمرین بیشتر، دفعهٔ بعد قشنگ‌تر! 🖌️",
      lines,
      score: st.score,
      detail: `میانگین ${fa(st.avg)}٪ (${DIFF[s.difficulty]})`,
      stats: st,
    });
  };

  const canvas = useCanvasLoop((g, w, h, dt) => {
    const s = sim.current;
    t.current += dt;
    if (!pausedRef.current && !ended.current) stepFacePaint(s, dt);
    hud([
      { label: "مشتری", value: `${fa(Math.min(s.index + 1, s.customers.length))} از ${fa(s.customers.length)}` },
      { label: "زمان", value: formatTime(s.timeLeft), warn: s.timeLeft < 10 && s.showing <= 0 },
      { label: "امتیاز", value: fa(totalScore(s)) },
    ]);
    draw(g, w, h, s, paintLayer(), box.current, t.current);
    if (s.over && !ended.current) {
      ended.current = true;
      finish();
    }
  });

  return (
    <div className={styles.paintGame}>
      <div className={styles.padScreen}>
        <canvas
          ref={canvas}
          role="img"
          aria-label="صورت کودک برای گریم؛ طرح خواسته‌شده روی کارت گوشه است"
          onPointerDown={(e) => {
            if (!canPaint()) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = toFace(e);
            last.current = p;
            paint(p, p);
          }}
          onPointerMove={(e) => {
            if (!last.current || !canPaint()) return;
            const p = toFace(e);
            paint(last.current, p);
            last.current = p;
          }}
          onPointerUp={() => (last.current = null)}
          onPointerCancel={() => (last.current = null)}
        />
      </div>
      <div className={styles.paintTools} role="toolbar" aria-label="ابزار گریم">
        <div className={styles.swatches} role="group" aria-label="رنگ‌ها">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={styles.swatch}
              style={{ background: c.hex }}
              aria-label={c.name}
              aria-pressed={!eraser && color === c.id}
              onClick={() => {
                setColor(c.id);
                setEraser(false);
              }}
            />
          ))}
        </div>
        <div className={styles.brushes} role="group" aria-label="قلم‌مو">
          {BRUSHES.map((b, i) => (
            <button key={b.id} type="button" className={styles.brushBtn} aria-pressed={brush === i} aria-label={`قلم‌موی ${b.name}`} onClick={() => setBrush(i)}>
              <span style={{ width: 6 + i * 6, height: 6 + i * 6 }} />
            </button>
          ))}
          <button type="button" className={styles.brushBtn} aria-pressed={eraser} onClick={() => setEraser((v) => !v)}>
            🧽 پاک‌کن
          </button>
          <button type="button" className={styles.brushBtn} onClick={clearFace}>
            ↺ از نو
          </button>
          <button type="button" className={`${styles.brushBtn} ${styles.paintDone}`} onClick={done}>
            ✓ تمام شد
          </button>
        </div>
      </div>
    </div>
  );
}

/** The design's shapes in a square (x, y, size) — the card in the corner, the guide, and tests. */
function drawDesign(g: CanvasRenderingContext2D, d: Design, x: number, y: number, size: number, alpha: number, outline = false) {
  g.save();
  g.globalAlpha = alpha;
  g.lineCap = g.lineJoin = "round";
  for (const s of d.shapes) {
    const hex = COLORS[colorIndex(s.color) - 1].hex;
    g.beginPath();
    const pts = "fill" in s ? s.fill : s.line;
    pts.forEach(([u, v], i) => (i ? g.lineTo(x + u * size, y + v * size) : g.moveTo(x + u * size, y + v * size)));
    if (outline) {
      if ("fill" in s) g.closePath();
      g.setLineDash([Math.max(3, size * 0.012), Math.max(3, size * 0.012)]);
      g.strokeStyle = hex === "#ffffff" ? "#999" : hex;
      g.lineWidth = Math.max(1.5, size * 0.006);
      g.stroke();
    } else if ("fill" in s) {
      g.closePath();
      g.fillStyle = hex;
      g.fill();
    } else {
      g.strokeStyle = hex;
      g.lineWidth = s.width * size;
      g.stroke();
    }
  }
  g.restore();
}

function draw(g: CanvasRenderingContext2D, w: number, h: number, s: FacePaintState, paint: HTMLCanvasElement, box: { x: number; y: number; size: number }, time: number) {
  // the mirror of the kids' corner
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#2a2140");
  bg.addColorStop(1, "#16131f");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const wide = w > h * 1.15;
  const F = Math.min(h * 0.94, wide ? w * 0.6 : w * 0.96);
  const fx = wide ? (w - F) / 2 - Math.min(F * 0.18, (w - F) / 2 - 8) : (w - F) / 2;
  const fy = (h - F) / 2 + (wide ? 0 : h * 0.04);
  box.x = fx;
  box.y = fy;
  box.size = F;
  // bulbs around the mirror
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const on = 0.65 + 0.35 * Math.sin(time * 2 + i);
    g.fillStyle = `rgba(255, 228, 160, ${on})`;
    g.beginPath();
    g.arc(fx + F / 2 + Math.cos(a) * F * 0.52, fy + F / 2 + Math.sin(a) * F * 0.5, Math.max(3, F * 0.012), 0, Math.PI * 2);
    g.fill();
  }

  const c = s.customers[Math.min(s.index, s.customers.length - 1)];
  const X = (u: number) => fx + u * F;
  const Y = (v: number) => fy + v * F;
  // hair behind the head (long for girls), ears, neck, face
  g.fillStyle = c.hair;
  g.beginPath();
  if (c.girl) g.ellipse(X(0.5), Y(0.52), F * 0.47, F * 0.5, 0, 0, Math.PI * 2);
  else g.ellipse(X(0.5), Y(0.36), F * 0.44, F * 0.33, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = c.skin;
  g.fillRect(X(0.42), Y(0.9), F * 0.16, F * 0.12);
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(X(0.5 + side * (FACE.rx + 0.01)), Y(0.53), F * 0.05, F * 0.08, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.ellipse(X(FACE.cx), Y(FACE.cy), F * FACE.rx, F * FACE.ry, 0, 0, Math.PI * 2);
  g.fill();
  // cheeks
  g.fillStyle = "rgba(255, 120, 120, 0.18)";
  for (const u of [0.27, 0.73]) {
    g.beginPath();
    g.ellipse(X(u), Y(0.66), F * 0.07, F * 0.045, 0, 0, Math.PI * 2);
    g.fill();
  }

  // the paint, then the guide (easy: faint picture + outline; normal: outline; hard: none)
  g.drawImage(paint, fx, fy, F, F);
  if (s.showing <= 0) {
    if (s.difficulty === "easy") drawDesign(g, c.design, fx, fy, F, 0.18);
    if (s.difficulty !== "hard") drawDesign(g, c.design, fx, fy, F, 0.55, true);
  }

  // fringe, eyes (they blink), nose, mouth
  g.fillStyle = c.hair;
  g.beginPath();
  g.ellipse(X(0.5), Y(0.1), F * 0.36, F * 0.07, 0, 0, Math.PI * 2);
  g.fill();
  const blink = Math.sin(time * 1.3 + s.index) > 0.985;
  for (const [u, v] of EYES) {
    g.fillStyle = "#fff";
    g.beginPath();
    g.ellipse(X(u), Y(v), F * 0.05, blink ? F * 0.006 : F * 0.035, 0, 0, Math.PI * 2);
    g.fill();
    if (!blink) {
      g.fillStyle = "#2b1a10";
      g.beginPath();
      g.arc(X(u), Y(v) + F * 0.004, F * 0.021, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(X(u) + F * 0.008, Y(v) - F * 0.006, F * 0.006, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = "rgba(120, 60, 40, 0.5)";
  g.lineWidth = Math.max(1.5, F * 0.006);
  g.beginPath();
  g.arc(X(0.5), Y(0.6), F * 0.02, 0.2, Math.PI - 0.2);
  g.stroke();
  const happy = s.showing > 0 ? (s.results.at(-1)?.percent ?? 0) >= 40 : true;
  g.strokeStyle = "#a33a3a";
  g.lineWidth = Math.max(2, F * 0.01);
  g.lineCap = "round";
  g.beginPath();
  if (happy) g.arc(X(MOUTH.x), Y(MOUTH.y) - F * 0.03, F * 0.07, 0.25, Math.PI - 0.25);
  else g.arc(X(MOUTH.x), Y(MOUTH.y) + F * 0.04, F * 0.05, Math.PI + 0.4, -0.4);
  g.stroke();

  // the request card
  const T = Math.min(wide ? Math.min(F * 0.5, w - (fx + F) - 16) : F * 0.36, 240);
  const tx = wide ? fx + F + (w - fx - F - T) / 2 : w - T - 8;
  const ty = wide ? Math.max(12, fy + F * 0.08) : 8;
  if (T > 60) {
    g.fillStyle = "rgba(255, 255, 255, 0.94)";
    g.beginPath();
    g.roundRect(tx, ty, T, T * 1.22, 12);
    g.fill();
    g.fillStyle = "#2b2140";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `700 ${Math.round(T * 0.075)}px Vazirmatn, Tahoma, sans-serif`;
    g.fillText(`${c.name} می‌خواهد:`, tx + T / 2, ty + T * 0.09);
    const m = T * 0.78;
    const mx = tx + (T - m) / 2;
    const my = ty + T * 0.16;
    g.fillStyle = c.skin;
    g.beginPath();
    g.ellipse(mx + FACE.cx * m, my + FACE.cy * m, FACE.rx * m, FACE.ry * m, 0, 0, Math.PI * 2);
    g.fill();
    drawDesign(g, c.design, mx, my, m, 1);
    g.fillStyle = "#2b2140";
    g.font = `800 ${Math.round(T * 0.085)}px Vazirmatn, Tahoma, sans-serif`;
    g.fillText(`${c.design.emoji} ${c.design.name}`, tx + T / 2, ty + T * 1.12);
  }

  // result of the face just finished
  if (s.showing > 0) {
    const r = s.results.at(-1)!;
    const re = reaction(r.percent);
    g.fillStyle = "rgba(0, 0, 0, 0.45)";
    g.fillRect(0, h * 0.36, w, h * 0.28);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `${Math.round(Math.min(w, h) * 0.1)}px sans-serif`;
    g.fillText(re.emoji, w / 2, h * 0.44);
    g.fillStyle = r.percent >= 65 ? "#39ff88" : "#ffd23a";
    g.font = `800 ${Math.round(Math.min(w, h) * 0.05)}px Vazirmatn, Tahoma, sans-serif`;
    g.fillText(`${re.text} ${fa(r.percent)}٪ شبیه — ${fa(r.points)} امتیاز`, w / 2, h * 0.55);
  }
}
