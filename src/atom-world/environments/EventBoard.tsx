"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { boardTournaments, eventsStore, formatStart, STATUS_LABEL, type TournamentItem } from "../data/events";
import { EVENTS_BOARD } from "../data/environment";
import { worldStore } from "../store";

const W = 1024;
const H = 648;

/**
 * Virtual tournaments & events board: a floating hologram (not a real object of the club). It shows
 * up to three tournaments from the site; walking up to it opens the full list. Drawn at its item's
 * place (the «events-board» item, movable in the admin editor).
 */
export function EventBoard() {
  const { canvas, tex } = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, tex: t };
  }, []);
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    const redraw = () => {
      const s = eventsStore.get();
      paint(canvas, s.loaded ? boardTournaments(s.tournaments).slice(0, 3) : null);
      markDirty(tex);
    };
    redraw();
    // the font may arrive after the first paint
    void document.fonts?.ready.then(redraw);
    const unsub = eventsStore.subscribe(redraw);
    return () => {
      unsub();
      tex.dispose();
    };
  }, [canvas, tex]);

  useFrame(({ clock }) => {
    // «کاهش حرکت»: no bobbing, no flicker
    const t = worldStore.get().reducedMotion ? 0 : clock.elapsedTime;
    if (group.current) group.current.position.y = EVENTS_BOARD.y + Math.sin(t * 1.3) * 0.035;
    // faint hologram flicker
    if (mat.current) mat.current.opacity = 0.9 + Math.sin(t * 23) * 0.02 + (Math.sin(t * 3.1) > 0.995 ? -0.25 : 0);
  });

  const { width: bw, height: bh } = EVENTS_BOARD;
  return (
    <group>
      <group position={[0, EVENTS_BOARD.y, 0]} ref={group}>
        {/* glow behind the panel */}
        <mesh position={[0, 0, -0.01]} userData={{ noBatch: true }}>
          <planeGeometry args={[bw + 0.14, bh + 0.14]} />
          <meshBasicMaterial color="#39ff88" transparent opacity={0.16} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh userData={{ noBatch: true }} renderOrder={6}>
          <planeGeometry args={[bw, bh]} />
          <meshBasicMaterial ref={mat} map={tex} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
        {/* light beam from the floor: the "projector" of the hologram */}
        <mesh position={[0, -EVENTS_BOARD.y / 2 - bh / 4, 0]} userData={{ noBatch: true }}>
          <cylinderGeometry args={[0.18, 0.04, EVENTS_BOARD.y - bh / 2, 16, 1, true]} />
          <meshBasicMaterial color="#39ff88" transparent opacity={0.08} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
}

function paint(c: HTMLCanvasElement, list: TournamentItem[] | null) {
  const ctx = c.getContext("2d")!;
  const font = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif";
  ctx.clearRect(0, 0, W, H);
  // translucent dark glass with a neon frame
  ctx.fillStyle = "rgba(4, 14, 9, 0.78)";
  roundRect(ctx, 6, 6, W - 12, H - 12, 34);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#39ff88";
  ctx.shadowColor = "#39ff88";
  ctx.shadowBlur = 24;
  ctx.stroke();
  ctx.shadowBlur = 0;
  // scan lines
  ctx.fillStyle = "rgba(57,255,136,0.05)";
  for (let y = 12; y < H; y += 8) ctx.fillRect(12, y, W - 24, 2);

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#39ff88";
  ctx.font = `900 64px ${font}`;
  ctx.fillText("تورنومنت‌ها و رویدادها", W - 56, 82);
  ctx.strokeStyle = "rgba(57,255,136,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(56, 136);
  ctx.lineTo(W - 56, 136);
  ctx.stroke();

  if (!list) {
    ctx.fillStyle = "#cfd5d1";
    ctx.font = `600 40px ${font}`;
    ctx.fillText("در حال دریافت از سایت…", W - 56, 260);
  } else if (list.length === 0) {
    ctx.fillStyle = "#e9ecea";
    ctx.font = `700 42px ${font}`;
    ctx.fillText("فعلاً تورنومنتی اعلام نشده است.", W - 56, 250);
    ctx.fillStyle = "#a8ada9";
    ctx.font = `500 34px ${font}`;
    ctx.fillText("نزدیک بیایید تا فهرست کامل سایت را ببینید.", W - 56, 320);
  } else {
    list.forEach((t, i) => {
      const y = 200 + i * 128;
      const chip = STATUS_LABEL[t.status];
      ctx.font = `800 30px ${font}`;
      const cw = ctx.measureText(chip).width + 36;
      ctx.fillStyle = t.status === "REGISTRATION" ? "rgba(57,255,136,0.22)" : t.status === "IN_PROGRESS" ? "rgba(255,79,160,0.25)" : "rgba(255,255,255,0.12)";
      roundRect(ctx, W - 56 - cw, y - 24, cw, 48, 24);
      ctx.fill();
      ctx.fillStyle = t.status === "REGISTRATION" ? "#39ff88" : t.status === "IN_PROGRESS" ? "#ff8cc0" : "#c9cdca";
      ctx.fillText(chip, W - 56 - 18, y + 1);
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 40px ${font}`;
      ctx.fillText(ellipsis(ctx, t.name, W - 140 - cw), W - 80 - cw, y);
      ctx.fillStyle = "#a8ada9";
      ctx.font = `500 30px ${font}`;
      ctx.fillText(ellipsis(ctx, `${t.game} · ${formatStart(t.startsAt)}`, W - 112), W - 56, y + 50);
    });
  }
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillStyle = "rgba(168,173,169,0.75)";
  ctx.font = `500 24px ${font}`;
  ctx.fillText("ATOM WORLD · virtual board", 56, H - 44);
}

function markDirty(t: THREE.Texture) {
  t.needsUpdate = true;
}

function ellipsis(ctx: CanvasRenderingContext2D, s: string, max: number) {
  if (ctx.measureText(s).width <= max) return s;
  let t = s;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
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
