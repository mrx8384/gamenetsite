/**
 * Builds the 3D look of «شهر اتم» from the pure city data (engine.ts): the street texture, one merged
 * mesh for all building walls (windows tile in metres), roofs, name signs (one texture atlas), and
 * positions for trees and street lamps. Client only (uses canvas). Engine x → three x, engine y → three z.
 */
import * as THREE from "three";
import { block, type Building, type CityState, N, P, ROAD, SIZE, WALK } from "./engine";

export type BlockKind = "club" | "park" | "parking" | "city";
const FALLBACK_FONT = "Vazirmatn, Tahoma, sans-serif";
/** The page's own font family (next/font gives it a generated name), for text drawn on canvases. */
export const pageFont = () => (typeof document !== "undefined" && getComputedStyle(document.body).fontFamily) || FALLBACK_FONT;

/** Block kinds (club, park, parking, buildings), from the city's contents. */
export function blockKinds(s: Pick<CityState, "buildings" | "trees">) {
  const kinds: BlockKind[][] = [];
  for (let i = 0; i < N; i++) {
    kinds.push([]);
    for (let j = 0; j < N; j++) {
      const b = block(i, j);
      const has = (x: number, y: number) => x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1;
      kinds[i].push(
        s.buildings.some((bd) => bd.club && has(bd.x0 + 1, bd.y0 + 1))
          ? "club"
          : s.trees.some((t) => has(t.x, t.y))
            ? "park"
            : s.buildings.some((bd) => has(bd.x0 + 0.5, bd.y0 + 0.5))
              ? "city"
              : "parking",
      );
    }
  }
  return kinds;
}

const hash = (v: number) => {
  const x = Math.sin(v * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Height of a building (m): the same every time; named places are low so their signs show. */
export function buildingHeight(b: Building) {
  if (b.club) return 9;
  const h = hash(b.x0 * 7.13 + b.y0 * 3.71);
  return b.name ? 7 + Math.floor(h * 2) * 2 : 10 + Math.floor(h * 4) * 3.5;
}

/** Streets seen from above: asphalt, lane dashes, zebra crossings, sidewalks, parks, parking lots. */
export function groundTexture(kinds: BlockKind[][], px: number) {
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d")!;
  const k = px / SIZE;
  g.fillStyle = "#3a3e44";
  g.fillRect(0, 0, px, px);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const b = block(i, j);
      g.fillStyle = "#b8b2a4";
      g.fillRect(b.x0 * k, b.y0 * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k);
      g.strokeStyle = "#8a857b";
      g.lineWidth = Math.max(1, k * 0.18);
      g.strokeRect(b.x0 * k, b.y0 * k, (b.x1 - b.x0) * k, (b.y1 - b.y0) * k);
      // sidewalk slabs
      g.strokeStyle = "rgba(0,0,0,0.08)";
      g.lineWidth = 1;
      for (let t = b.x0 + 1.5; t < b.x1; t += 1.5) {
        g.beginPath();
        g.moveTo(t * k, b.y0 * k);
        g.lineTo(t * k, (b.y0 + WALK) * k);
        g.moveTo(t * k, (b.y1 - WALK) * k);
        g.lineTo(t * k, b.y1 * k);
        g.stroke();
      }
      const kind = kinds[i][j];
      g.fillStyle = kind === "park" ? "#5f8f4a" : kind === "parking" ? "#55595f" : kind === "club" ? "#2a2d30" : "#a39e92";
      const lx = (b.x0 + WALK) * k;
      const ly = (b.y0 + WALK) * k;
      const lw = (b.x1 - b.x0 - 2 * WALK) * k;
      const lh = (b.y1 - b.y0 - 2 * WALK) * k;
      g.fillRect(lx, ly, lw, lh);
      if (kind === "park") {
        // paths
        g.fillStyle = "#c8b98f";
        g.fillRect(lx + lw / 2 - k * 0.6, ly, k * 1.2, lh);
        g.fillRect(lx, ly + lh / 2 - k * 0.6, lw, k * 1.2);
      }
      if (kind === "parking") {
        g.strokeStyle = "rgba(255,255,255,0.7)";
        g.lineWidth = Math.max(1, k * 0.12);
        for (let s = 0; s < 4; s++) {
          const x = (b.x0 + WALK + 0.4 + s * 3.6) * k;
          g.beginPath();
          g.moveTo(x, ly);
          g.lineTo(x, ly + 4.6 * k);
          g.stroke();
        }
      }
    }
  // lane dashes between intersections
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = Math.max(1, k * 0.15);
  g.setLineDash([k * 1.6, k * 1.6]);
  for (let r = 0; r <= N; r++) {
    const c0 = (r * P + ROAD / 2) * k;
    for (let seg = 0; seg < N; seg++) {
      const a = (seg * P + ROAD + 0.6) * k;
      const z = ((seg + 1) * P - 0.6) * k;
      g.beginPath();
      g.moveTo(a, c0);
      g.lineTo(z, c0);
      g.moveTo(c0, a);
      g.lineTo(c0, z);
      g.stroke();
    }
  }
  g.setLineDash([]);
  // zebra crossings on every side of every intersection
  g.fillStyle = "rgba(240,240,240,0.85)";
  const bar = 0.45;
  for (let ix = 0; ix <= N; ix++)
    for (let iy = 0; iy <= N; iy++) {
      const x0 = ix * P;
      const y0 = iy * P;
      for (let t = 0.4; t < ROAD - 0.3; t += 0.85) {
        if (ix < N) g.fillRect((x0 + ROAD + 0.3) * k, (y0 + t) * k, 1.5 * k, bar * k); // east
        if (ix > 0) g.fillRect((x0 - 1.8) * k, (y0 + t) * k, 1.5 * k, bar * k); // west
        if (iy < N) g.fillRect((x0 + t) * k, (y0 + ROAD + 0.3) * k, bar * k, 1.5 * k); // south
        if (iy > 0) g.fillRect((x0 + t) * k, (y0 - 1.8) * k, bar * k, 1.5 * k); // north
      }
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 4 × 4 window cells; walls are white so the vertex colour tints them. */
export function windowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 256, 256);
  const glass = ["#5f7486", "#6d8398", "#7d93a7", "#56697a", "#8aa0b3"];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const x = i * 64;
      const y = j * 64;
      g.fillStyle = "#d9d6d0";
      g.fillRect(x + 10, y + 12, 44, 38);
      g.fillStyle = glass[(i * 3 + j * 7) % glass.length];
      g.fillRect(x + 13, y + 15, 38, 32);
      g.fillStyle = "rgba(255,255,255,0.22)";
      g.fillRect(x + 13, y + 15, 38, 8);
      g.fillStyle = "#c9c5bd";
      g.fillRect(x + 8, y + 50, 48, 4);
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const CELL = 3.2; // one window cell (m)

interface Arrays {
  pos: number[];
  nor: number[];
  uv: number[];
  col: number[];
  idx: number[];
}
const arrays = (): Arrays => ({ pos: [], nor: [], uv: [], col: [], idx: [] });
function toGeometry(a: Arrays) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(a.uv, 2));
  if (a.col.length) geo.setAttribute("color", new THREE.Float32BufferAttribute(a.col, 3));
  geo.setIndex(a.idx);
  geo.computeBoundingSphere();
  return geo;
}
/** Quad from 4 corners given counter-clockwise as seen from the front. */
function quad(a: Arrays, v: number[][], n: number[], uv: number[][], cols?: THREE.Color[]) {
  const base = a.pos.length / 3;
  for (let k = 0; k < 4; k++) {
    a.pos.push(...v[k]);
    a.nor.push(...n);
    a.uv.push(...uv[k]);
    if (cols) a.col.push(cols[k].r, cols[k].g, cols[k].b);
  }
  a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/** Walls of every building (one mesh) and their roofs (another). */
export function buildingGeometry(bs: Building[]) {
  const walls = arrays();
  const roofs = arrays();
  for (const b of bs) {
    const h = buildingHeight(b);
    // the club's walls are dark in the data (2D map); in 3D a dark plum shows its shape
    const top = new THREE.Color(b.club ? "#4a4256" : b.color);
    const bottom = top.clone().multiplyScalar(0.62);
    const cols = [bottom, bottom, top, top];
    const wall = (ax: number, az: number, bx: number, bz: number, n: number[]) => {
      const len = Math.hypot(bx - ax, bz - az);
      const u = len / (CELL * 4);
      const v = h / (CELL * 4);
      quad(
        walls,
        [
          [ax, 0, az],
          [bx, 0, bz],
          [bx, h, bz],
          [ax, h, az],
        ],
        n,
        [
          [0, 0],
          [u, 0],
          [u, v],
          [0, v],
        ],
        cols,
      );
    };
    // left → right as seen from outside each face
    wall(b.x0, b.y1, b.x1, b.y1, [0, 0, 1]); // south (+z)
    wall(b.x1, b.y0, b.x0, b.y0, [0, 0, -1]); // north
    wall(b.x1, b.y1, b.x1, b.y0, [1, 0, 0]); // east
    wall(b.x0, b.y0, b.x0, b.y1, [-1, 0, 0]); // west
    const rc = new THREE.Color(b.roof);
    const rim = rc.clone().multiplyScalar(0.8);
    quad(
      roofs,
      [
        [b.x0, h, b.y1],
        [b.x1, h, b.y1],
        [b.x1, h, b.y0],
        [b.x0, h, b.y0],
      ],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [rim, rc, rc, rim],
    );
  }
  return { walls: toGeometry(walls), roofs: toGeometry(roofs) };
}

/** Rooftop boxes (air conditioners, stair huts) for the tall buildings: [x, y(top), z, sx, sy, sz]. */
export function roofBoxes(bs: Building[]) {
  const out: number[][] = [];
  for (const b of bs) {
    if (b.club || b.name) continue;
    const h = buildingHeight(b);
    const r = hash(b.x1 * 1.7 + b.y1 * 9.1);
    const cx = b.x0 + (b.x1 - b.x0) * (0.25 + r * 0.5);
    const cz = b.y0 + (b.y1 - b.y0) * (0.3 + hash(r * 77) * 0.4);
    out.push([cx, h, cz, 2.2, 1.6, 2.2]);
    if (r > 0.4) out.push([b.x0 + 1.4, h, b.y1 - 1.4, 1.1, 0.7, 1.1]);
  }
  return out;
}

const SIGN_ROW = 64;
const SIGN_W = 512;

/** Name signs on the walls of the named places (one atlas texture, one mesh); redraw after the font loads. */
export function signs(bs: Building[]) {
  const named = bs.filter((b) => b.name && !b.club);
  const rows = Math.max(1, named.length);
  const c = document.createElement("canvas");
  c.width = SIGN_W;
  c.height = SIGN_ROW * Math.pow(2, Math.ceil(Math.log2(rows)));
  const draw = () => {
    const g = c.getContext("2d")!;
    named.forEach((b, i) => {
      const y = i * SIGN_ROW;
      g.fillStyle = "#14181c";
      g.fillRect(0, y, SIGN_W, SIGN_ROW);
      g.fillStyle = "#f2c230";
      g.fillRect(0, y + SIGN_ROW - 6, SIGN_W, 6);
      g.fillStyle = "#ffffff";
      g.font = `800 40px ${pageFont()}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.direction = "rtl";
      g.fillText(b.name!, SIGN_W / 2, y + SIGN_ROW / 2 - 2);
    });
  };
  draw();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const a = arrays();
  named.forEach((b, i) => {
    const v1 = 1 - (i * SIGN_ROW) / c.height;
    const v0 = 1 - ((i + 1) * SIGN_ROW) / c.height;
    const uv = [
      [0, v0],
      [1, v0],
      [1, v1],
      [0, v1],
    ];
    const y0 = 3.1;
    const y1 = 4.0;
    const face = (cx: number, cz: number, dx: number, dz: number, n: number[], len: number) => {
      const w = Math.min(7.2, len - 1) / 2;
      quad(
        a,
        [
          [cx - dx * w, y0, cz - dz * w],
          [cx + dx * w, y0, cz + dz * w],
          [cx + dx * w, y1, cz + dz * w],
          [cx - dx * w, y1, cz - dz * w],
        ],
        n,
        uv,
      );
    };
    const mx = (b.x0 + b.x1) / 2;
    const mz = (b.y0 + b.y1) / 2;
    const e = 0.06;
    face(mx, b.y1 + e, 1, 0, [0, 0, 1], b.x1 - b.x0); // south
    face(mx, b.y0 - e, -1, 0, [0, 0, -1], b.x1 - b.x0); // north
    face(b.x1 + e, mz, 0, -1, [1, 0, 0], b.y1 - b.y0); // east
    face(b.x0 - e, mz, 0, 1, [-1, 0, 0], b.y1 - b.y0); // west
  });
  const redraw = () => {
    draw();
    tex.needsUpdate = true;
  };
  return { geometry: toGeometry(a), texture: tex, redraw };
}

/** Glowing «ATOM GAME CLUB» sign. */
export function clubSignTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 160;
  const draw = () => {
    const g = c.getContext("2d")!;
    g.fillStyle = "#050605";
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = "#39ff88";
    g.lineWidth = 6;
    g.strokeRect(6, 6, 500, 148);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#39ff88";
    g.font = `900 78px ${pageFont()}`;
    g.fillText("ATOM", 256, 62);
    g.fillStyle = "#ff4fa3";
    g.font = `800 34px ${pageFont()}`;
    g.fillText("GAME CLUB", 256, 124);
  };
  draw();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const redraw = () => {
    draw();
    tex.needsUpdate = true;
  };
  return { texture: tex, redraw };
}

/** Small «ATOM» sign on the taxi roof. */
export function taxiSignTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 48;
  const g = c.getContext("2d")!;
  g.fillStyle = "#050605";
  g.fillRect(0, 0, 128, 48);
  g.fillStyle = "#39ff88";
  g.font = `900 34px ${pageFont()}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("ATOM", 64, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft round shadow for cars and people (no real-time shadows: cheap on phones). */
export function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  r.addColorStop(0, "rgba(0,0,0,0.55)");
  r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Flat arrow (lying on the ground plane, pointing +x) for the way to the job. */
export function arrowGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(0.9, 0);
  sh.lineTo(0.1, -0.6);
  sh.lineTo(0.1, -0.22);
  sh.lineTo(-0.8, -0.22);
  sh.lineTo(-0.8, 0.22);
  sh.lineTo(0.1, 0.22);
  sh.lineTo(0.1, 0.6);
  sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.3, bevelEnabled: false });
  // shape is in x/y: lay it flat and centre its thickness
  geo.translate(0, 0, -0.15);
  geo.rotateX(Math.PI / 2);
  return geo;
}

/** Street lamps on the corners of every block: [x, z]. */
export function lampSpots() {
  const out: [number, number][] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const b = block(i, j);
      out.push([b.x0 + 0.45, b.y0 + 0.45], [b.x1 - 0.45, b.y1 - 0.45]);
    }
  return out;
}
