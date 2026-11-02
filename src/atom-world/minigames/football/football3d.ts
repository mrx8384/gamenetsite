import * as THREE from "three";
import type { CharacterLook } from "../../data/characters";
import type { BodyBuild } from "../../characters/buildToonCharacter";
import { pageFont } from "../city/city3d";
import { fa } from "../types";
import { GOAL, L, W } from "./engine";

/**
 * Pieces of the 3D «فوتبال اتم» (textures, kits, sizes). The rules stay in ./engine.ts; this only
 * draws them. Engine x (0..L, towards the goal ATOM attacks) → world X = x − L/2; engine y (0..W,
 * down on the old 2D screen) → world Z = y − W/2. So a camera on the +Z side sees ATOM attack to the
 * right, as before.
 */
export const toX = (x: number) => x - L / 2;
export const toZ = (y: number) => y - W / 2;

export const GOAL_H = 2.4;
export const GOAL_D = 1.6;
export const BOARD_H = 0.9;
/** Visual ball radius (the rules use a bigger one for touches). */
export const BALL_R = 0.36;

/** Kit colours: [ATOM, rival] for field players and keepers (the 2D game's colours). */
const KITS = {
  field: [
    { shirt: "#27c86b", accent: "#0c0f0d", shorts: "#111513", trim: "#27c86b", socks: "#111513", number: "#0c0f0d" },
    { shirt: "#e8458f", accent: "#ffffff", shorts: "#ffffff", trim: "#e8458f", socks: "#e8458f", number: "#ffffff" },
  ],
  gk: [
    { shirt: "#f2c230", accent: "#111513", shorts: "#111513", trim: "#f2c230", socks: "#f2c230", number: "#111513" },
    { shirt: "#4f7dff", accent: "#ffffff", shorts: "#1d2a55", trim: "#4f7dff", socks: "#4f7dff", number: "#ffffff" },
  ],
} as const;

const SKINS = ["#e9b892", "#f2cdb0", "#c98f68", "#d9a57e", "#f0c7a6", "#b97f5a"];
const HAIRS = ["#151210", "#2b1d14", "#4a2e1d", "#1d1512", "#6b4a2b", "#0e0c0b"];
const BUILDS: BodyBuild[] = ["tall", "average", "slim", "tall", "average", "slim"];

export function kitLook(team: 0 | 1, role: "gk" | "field", id: number): { look: CharacterLook; build: BodyBuild; number: string } {
  const k = KITS[role][team];
  return {
    look: {
      plain: true,
      kit: { socks: k.socks },
      skin: SKINS[id % SKINS.length],
      hair: HAIRS[(id * 5) % HAIRS.length],
      hairStyle: "short-messy",
      jacket: k.shirt,
      jacketAccent: k.accent,
      hoodie: k.shirt,
      shirt: k.shirt,
      pants: k.shorts,
      pantsAccent: k.trim,
      shoe: team === 0 ? "#141716" : "#f4f4f4",
      shoeAccent: team === 0 ? "#27c86b" : "#e8458f",
      sole: "#e6e6e6",
      headphones: "#222222",
      headphonesAccent: "#222222",
      logo: "#222222",
    },
    build: BUILDS[id % BUILDS.length],
    number: k.number,
  };
}

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
};

/** Grass with mowing stripes and the futsal lines (the same lines as the 2D game). `ppm` = pixels per metre. */
export function pitchTexture(ppm: number) {
  const [c, g] = canvas(Math.round(L * ppm), Math.round(W * ppm));
  const P = (m: number) => m * ppm;
  for (let k = 0; k < 12; k++) {
    g.fillStyle = k % 2 ? "#2f8f41" : "#36a04b";
    g.fillRect(Math.floor(P((k * L) / 12)), 0, Math.ceil(P(L / 12)) + 1, c.height);
  }
  // a little texture in the grass
  for (let i = 0; i < (c.width * c.height) / 90; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.05)";
    g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  g.strokeStyle = "rgba(255,255,255,0.92)";
  g.lineWidth = Math.max(2, P(0.12));
  const lw = g.lineWidth / 2;
  g.strokeRect(lw, lw, c.width - lw * 2, c.height - lw * 2);
  g.beginPath();
  g.moveTo(P(L / 2), 0);
  g.lineTo(P(L / 2), c.height);
  g.stroke();
  g.beginPath();
  g.arc(P(L / 2), P(W / 2), P(5), 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.92)";
  for (const [x, r] of [
    [L / 2, 0.25],
    [5, 0.18],
    [L - 5, 0.18],
  ] as const) {
    g.beginPath();
    g.arc(P(x), P(W / 2), P(r), 0, Math.PI * 2);
    g.fill();
  }
  for (const side of [0, 1]) {
    const x0 = side ? L - 7 : 0;
    g.strokeRect(P(x0), P(W / 2 - 8), P(7), P(16));
    // corner arcs
    for (const y of [0, W]) {
      g.beginPath();
      g.arc(P(side ? L : 0), P(y), P(1), 0, Math.PI * 2);
      g.stroke();
    }
  }
  // ATOM in the centre circle
  g.fillStyle = "rgba(255,255,255,0.13)";
  g.font = `900 ${Math.round(P(2.4))}px ${pageFont()}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("ATOM", P(L / 2), P(W / 2));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Advertising boards around the pitch: the club's own names only. */
export function boardsTexture() {
  const [c, g] = canvas(2048, 96);
  const ads: [string, string, string][] = [
    ["ATOM GAME CLUB", "#0b0d0c", "#39ff88"],
    ["اتم گیم کلاب", "#0f5c31", "#ffffff"],
    ["گیم‌نت اتم · PS5 · PS4", "#111111", "#ffffff"],
    ["شهربازی اتم", "#0b0d0c", "#ffd23a"],
  ];
  const w = c.width / ads.length;
  ads.forEach(([text, bg, fg], i) => {
    g.fillStyle = bg;
    g.fillRect(i * w, 0, w, c.height);
    g.fillStyle = fg;
    g.font = `800 46px ${pageFont()}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.direction = /[a-z]/i.test(text[0]) ? "ltr" : "rtl";
    g.fillText(text, i * w + w / 2, c.height / 2 + 2, w - 30);
    g.fillStyle = "#39ff88";
    g.fillRect(i * w, c.height - 6, w, 6);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** White net mesh on a transparent background (repeated over the goal's sides). */
export function netTexture() {
  const [c, g] = canvas(64, 64);
  g.strokeStyle = "rgba(255,255,255,0.75)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, 62, 62);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Rows of supporters (green and pink scarves) for the stands. */
export function crowdTexture() {
  const [c, g] = canvas(512, 128);
  g.fillStyle = "#1a1f2b";
  g.fillRect(0, 0, c.width, c.height);
  const cols = ["#39ff88", "#27c86b", "#e8458f", "#ffffff", "#f2c230", "#6c9bff", "#2d3546", "#c9b29a"];
  for (let row = 0; row < 4; row++)
    for (let x = 4; x < c.width; x += 11) {
      const y = 22 + row * 30 + (Math.random() - 0.5) * 4;
      g.fillStyle = cols[Math.floor(Math.random() * cols.length)];
      g.beginPath();
      g.ellipse(x + Math.random() * 3, y + 9, 5, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = ["#e9b892", "#c98f68", "#f2cdb0", "#8a5a3c"][Math.floor(Math.random() * 4)];
      g.beginPath();
      g.arc(x + Math.random() * 3, y - 2, 3.6, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Classic black-and-white ball: 12 dark patches at the corners of an icosahedron (equirectangular map). */
export function ballTexture() {
  const [c, g] = canvas(256, 128);
  const img = g.createImageData(c.width, c.height);
  const t = (1 + Math.sqrt(5)) / 2;
  const dirs = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map(([x, y, z]) => {
    const n = Math.hypot(x, y, z);
    return [x / n, y / n, z / n];
  });
  for (let j = 0; j < c.height; j++) {
    const lat = Math.PI * (0.5 - (j + 0.5) / c.height);
    for (let i = 0; i < c.width; i++) {
      const lon = 2 * Math.PI * ((i + 0.5) / c.width) - Math.PI;
      const v = [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
      let best = -1;
      for (const d of dirs) best = Math.max(best, d[0] * v[0] + d[1] * v[1] + d[2] * v[2]);
      const dark = best > 0.93;
      const seam = !dark && best > 0.905;
      const o = (j * c.width + i) * 4;
      const col = dark ? 22 : seam ? 150 : 246;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = col;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Shirt number for the back of a jersey (Persian digits, as in the 2D game). */
export function numberTexture(n: number, color: string) {
  const [c, g] = canvas(128, 128);
  g.font = `900 92px ${pageFont()}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 6;
  g.strokeStyle = color === "#ffffff" ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.35)";
  g.strokeText(fa(n), 64, 70);
  g.fillStyle = color;
  g.fillText(fa(n), 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The stadium screen: score and time. Redrawn only when the text changes. */
export function drawScoreboard(g: CanvasRenderingContext2D, w: number, h: number, score: [number, number], secondsLeft: number) {
  g.fillStyle = "#07090a";
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#39ff88";
  g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);
  const font = pageFont();
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.direction = "rtl";
  g.fillStyle = "#39ff88";
  g.font = `800 46px ${font}`;
  g.fillText("اتم", w * 0.83, h * 0.42);
  g.fillStyle = "#ff7ab8";
  g.fillText("حریف", w * 0.17, h * 0.42);
  g.fillStyle = "#ffffff";
  g.font = `900 72px ${font}`;
  g.direction = "ltr";
  g.fillText(`${fa(score[1])} – ${fa(score[0])}`, w / 2, h * 0.42);
  const s = Math.max(0, Math.ceil(secondsLeft));
  g.font = `700 34px ${font}`;
  g.fillStyle = "#f2c230";
  g.fillText(`⏱ ${fa(Math.floor(s / 60))}:${fa(s % 60).padStart(2, "۰")}`, w / 2, h * 0.8);
}

/** Corners of the goal mouth on the line (world). */
export const goalPosts = (side: 0 | 1) => {
  const x = side ? L / 2 : -L / 2;
  return [
    [x, -GOAL],
    [x, GOAL],
  ] as const;
};
