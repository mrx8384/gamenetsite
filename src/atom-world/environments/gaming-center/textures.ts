import * as THREE from "three";
import { slotText } from "../../world/slots";

/**
 * Drawn textures of the gaming center: re-drawings of the small printed items in the photos
 * (station number signs, chalkboard, coffee-cup logo, WELCOME paddle). Large wall art comes from
 * the photos themselves (public/atom-world/envs/gaming-center, scripts/make-gaming-center-textures.sh).
 */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d")! };
}

function toTexture(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const font = () => (typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif");

/** Gamepad-shaped bronze sign with «ATOM GAME» and the station number (photos 05–08). */
export function stationSignTexture(n: number) {
  const { c, ctx } = canvas(256, 160);
  ctx.fillStyle = "#3a2c1f";
  ctx.strokeStyle = "#c7a46a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(60, 30);
  ctx.lineTo(196, 30);
  ctx.bezierCurveTo(240, 30, 252, 120, 236, 142);
  ctx.bezierCurveTo(222, 158, 196, 140, 180, 116);
  ctx.lineTo(76, 116);
  ctx.bezierCurveTo(60, 140, 34, 158, 20, 142);
  ctx.bezierCurveTo(4, 120, 16, 30, 60, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e9d3a6";
  ctx.font = `700 18px ${font()}`;
  ctx.textAlign = "center";
  ctx.fillText("ATOM GAME", 128, 56);
  ctx.font = `900 54px ${font()}`;
  ctx.fillText(String(n), 128, 104);
  // d-pad and buttons
  ctx.fillRect(44, 66, 30, 8);
  ctx.fillRect(55, 55, 8, 30);
  for (const [x, y] of [
    [200, 60],
    [214, 72],
    [186, 72],
    [200, 84],
  ])
    ctx.fillRect(x - 4, y - 4, 8, 8);
  return toTexture(c);
}

/** Black chalkboard with «برگزاری تورنومنت» and @ATOMgclub in chalk (photo 05). */
export function chalkboardTexture() {
  const { c, ctx } = canvas(512, 336);
  ctx.fillStyle = "#1d1f1e";
  ctx.fillRect(0, 0, 512, 336);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 336, 30, 2);
  }
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#e7c6e8";
  ctx.font = `700 54px ${font()}`;
  ctx.fillText(slotText("gc-chalkboard-title"), 256, 110);
  ctx.direction = "ltr";
  ctx.fillStyle = "#e9e9e2";
  ctx.font = `500 30px ${font()}`;
  ctx.fillText(slotText("gc-chalkboard-handle"), 256, 270);
  ctx.strokeStyle = "#d9d9d0";
  ctx.lineWidth = 3;
  ctx.strokeRect(150, 236, 26, 26);
  return toTexture(c);
}

/** Grey stone panel with the brown coffee-cup logo on the counter front (photo 03). */
export function coffeeLogoTexture() {
  const { c, ctx } = canvas(256, 320);
  ctx.fillStyle = "#8c8e8b";
  ctx.fillRect(0, 0, 256, 320);
  for (let i = 0; i < 60; i++) {
    ctx.strokeStyle = `rgba(60,60,60,${0.05 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 320);
    ctx.lineTo(Math.random() * 256, Math.random() * 320);
    ctx.stroke();
  }
  ctx.fillStyle = "#5b3a20";
  ctx.beginPath();
  ctx.moveTo(70, 190);
  ctx.lineTo(186, 190);
  ctx.bezierCurveTo(186, 250, 160, 268, 128, 268);
  ctx.bezierCurveTo(96, 268, 70, 250, 70, 190);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#5b3a20";
  ctx.beginPath();
  ctx.arc(192, 222, 20, -1.2, 1.2);
  ctx.stroke();
  ctx.fillRect(50, 276, 156, 8);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(130, 178);
  ctx.bezierCurveTo(90, 140, 170, 120, 128, 70);
  ctx.stroke();
  return toTexture(c);
}

/** Wooden paddle with WELCOME (photos 13–14). */
export function welcomeTexture() {
  const { c, ctx } = canvas(512, 96);
  ctx.fillStyle = "#9b6b3f";
  ctx.beginPath();
  ctx.roundRect(110, 8, 396, 80, 18);
  ctx.fill();
  ctx.fillRect(0, 38, 120, 20);
  ctx.fillStyle = "#2b1d12";
  ctx.font = `800 52px ${font()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(slotText("gc-welcome"), 308, 50);
  return toTexture(c);
}

/** White PVC wall panels with vertical grooves (stair hall, photos 13–14). */
export function whitePanelTexture() {
  const { c, ctx } = canvas(128, 128);
  ctx.fillStyle = "#eef0f1";
  ctx.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 32) {
    ctx.fillStyle = "#c9ced2";
    ctx.fillRect(x, 0, 2, 128);
    ctx.fillStyle = "#fbfcfc";
    ctx.fillRect(x + 2, 0, 2, 128);
  }
  return toTexture(c, true);
}

/** Closed arch on the black panel (photo 05): a dark grey arch with a light rim, transparent around it. */
export function archInsetTexture() {
  const { c, ctx } = canvas(220, 450);
  const r = 110;
  ctx.beginPath();
  ctx.moveTo(0, 450);
  ctx.lineTo(0, r);
  ctx.arc(r, r, r, Math.PI, 0);
  ctx.lineTo(220, 450);
  ctx.closePath();
  ctx.fillStyle = "#d9d8d3";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, 450);
  ctx.lineTo(12, r);
  ctx.arc(r, r, r - 12, Math.PI, 0);
  ctx.lineTo(208, 450);
  ctx.closePath();
  ctx.fillStyle = "#2b2f34";
  ctx.fill();
  return toTexture(c);
}

/** Drinks behind the fridge glass (photo 03). */
export function fridgeTexture() {
  const { c, ctx } = canvas(128, 256);
  ctx.fillStyle = "#dfe9ee";
  ctx.fillRect(0, 0, 128, 256);
  const colors = ["#c8202a", "#f2b200", "#2c7a3d", "#8a2be2", "#e86a1a", "#1f5fbf", "#ffffff"];
  for (let row = 0; row < 6; row++) {
    ctx.fillStyle = "#9aa6ad";
    ctx.fillRect(0, row * 42 + 38, 128, 3);
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = colors[(row * 3 + k) % colors.length];
      ctx.fillRect(4 + k * 15, row * 42 + 12, 10, 26);
    }
  }
  return toTexture(c);
}
