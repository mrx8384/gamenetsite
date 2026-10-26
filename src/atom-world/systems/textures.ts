import * as THREE from "three";

/**
 * Procedural canvas textures for surfaces that are plain materials in the real club (tiles,
 * ceiling panels, cladding) and TEMPORARY re-drawings of printed graphics (the ATOM branding strip,
 * the counter badge). Replace the re-drawings with the original print files when available.
 */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

function toTexture(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Light glossy ceramic floor: 2×2 tiles of 80 cm. */
export function floorTilesTexture(size = 1024) {
  const { c, ctx } = canvas(size, size);
  const r = rng(7);
  const n = 2;
  const s = size / n;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const v = 232 + Math.floor(r() * 8);
      ctx.fillStyle = `rgb(${v},${v},${v + 1})`;
      ctx.fillRect(i * s, j * s, s, s);
      // faint marble clouds
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(200,200,205,${0.04 + r() * 0.05})`;
        ctx.beginPath();
        ctx.ellipse(i * s + r() * s, j * s + r() * s, 20 + r() * s * 0.35, 8 + r() * 30, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  ctx.strokeStyle = "#cfcfcf";
  ctx.lineWidth = Math.max(2, size / 400);
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s, 0);
    ctx.lineTo(i * s, size);
    ctx.moveTo(0, i * s);
    ctx.lineTo(size, i * s);
    ctx.stroke();
  }
  return toTexture(c);
}

/** White perforated ceiling panels: 2×2 panels of 60 cm. */
export function ceilingTilesTexture() {
  const size = 512;
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = "#f2f2ef";
  ctx.fillRect(0, 0, size, size);
  const r = rng(3);
  ctx.fillStyle = "rgba(120,120,120,0.18)";
  for (let k = 0; k < 2600; k++) ctx.fillRect(r() * size, r() * size, 1.4, 1.4);
  ctx.strokeStyle = "#c9c9c4";
  ctx.lineWidth = 4;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 256, 0);
    ctx.lineTo(i * 256, size);
    ctx.moveTo(0, i * 256);
    ctx.lineTo(size, i * 256);
    ctx.stroke();
  }
  return toTexture(c);
}

/** Cream marble-look wall cladding (lower part of the walls): two 60 cm panels. */
export function claddingTexture() {
  const w = 512;
  const h = 640;
  const { c, ctx } = canvas(w, h);
  const r = rng(11);
  ctx.fillStyle = "#e9e1d1";
  ctx.fillRect(0, 0, w, h);
  for (let k = 0; k < 18; k++) {
    ctx.strokeStyle = `rgba(${150 + r() * 40},${135 + r() * 30},${110 + r() * 30},${0.12 + r() * 0.18})`;
    ctx.lineWidth = 0.8 + r() * 2.2;
    ctx.beginPath();
    let x = r() * w;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < h) {
      x += (r() - 0.5) * 60;
      y += 30 + r() * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(160,150,130,0.55)";
  ctx.fillRect(w / 2 - 1, 0, 2, h);
  ctx.fillRect(0, 0, 2, h);
  return toTexture(c);
}

function atomIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, color: string, line: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = line;
  for (const a of [0, Math.PI / 3, -Math.PI / 3]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, rx * 0.36, a, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, rx * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function badge(ctx: CanvasRenderingContext2D, cx: number, cy: number, rad: number) {
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#19c45f";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.88, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffdf00";
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.56, 0, Math.PI * 2);
  ctx.fill();
  atomIcon(ctx, cx, cy, rad * 0.45, "#111", Math.max(1.5, rad * 0.06));
}

/**
 * ATOM GAME CLUB branding strip (TEMPORARY re-drawing of the printed band in the photos:
 * dark circuit-board pattern, green/lime lines, "ATOM | GAME CLUB" and round badges). One tile ≈ 4 m.
 */
export function brandingStripTexture() {
  const w = 2048;
  const h = 128;
  const { c, ctx } = canvas(w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#08130c");
  g.addColorStop(0.5, "#0c1d12");
  g.addColorStop(1, "#06100a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const r = rng(5);
  // circuit traces
  for (let k = 0; k < 70; k++) {
    ctx.strokeStyle = r() > 0.7 ? "rgba(198,244,50,0.75)" : "rgba(25,195,90,0.7)";
    ctx.lineWidth = 2 + r() * 2;
    const x = r() * w;
    const y = 10 + r() * (h - 20);
    const len = 40 + r() * 140;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len * 0.5, y);
    ctx.lineTo(x + len * 0.7, y + (r() > 0.5 ? 1 : -1) * 22);
    ctx.lineTo(x + len, y + (r() > 0.5 ? 1 : -1) * 22);
    ctx.stroke();
    ctx.fillStyle = "#c6f432";
    ctx.fillRect(x + len - 3, y - 3, 6, 6);
  }
  // edge lines
  ctx.fillStyle = "#19c35a";
  ctx.fillRect(0, 4, w, 3);
  ctx.fillRect(0, h - 7, w, 3);
  // two logo groups per tile
  for (const ox of [0, w / 2]) {
    badge(ctx, ox + 120, h / 2, 46);
    ctx.save();
    ctx.translate(ox + 420, h / 2 + 24);
    ctx.transform(1, 0, -0.25, 1, 0, 0);
    ctx.font = "900 70px Arial Black, Arial, sans-serif";
    ctx.fillStyle = "#d4ff3a";
    ctx.textAlign = "center";
    ctx.fillText("ATOM", 0, 0);
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(ox + 560, h / 2 - 26, 190, 48);
    ctx.strokeStyle = "#e8e8e8";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 560, h / 2 - 26, 190, 48);
    ctx.font = "700 32px Arial, sans-serif";
    ctx.fillStyle = "#f4f4f4";
    ctx.textAlign = "center";
    ctx.fillText("GAME CLUB", ox + 655, h / 2 + 11);
    atomIcon(ctx, ox + 860, h / 2, 30, "#c6f432", 3);
  }
  const t = toTexture(c);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Warm wood panelling (back wall under the mezzanine, pillar cladding). */
export function woodTexture() {
  const w = 512;
  const h = 512;
  const { c, ctx } = canvas(w, h);
  const r = rng(21);
  const planks = 4;
  for (let i = 0; i < planks; i++) {
    const base = 180 + r() * 20;
    ctx.fillStyle = `rgb(${base + 20},${base - 30},${base - 95})`;
    ctx.fillRect((i * w) / planks, 0, w / planks, h);
    for (let k = 0; k < 40; k++) {
      ctx.strokeStyle = `rgba(110,70,30,${0.08 + r() * 0.12})`;
      ctx.lineWidth = 1 + r() * 2;
      const x = (i * w) / planks + r() * (w / planks);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (r() - 0.5) * 20, h / 3, x + (r() - 0.5) * 20, (2 * h) / 3, x + (r() - 0.5) * 10, h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(80,50,20,0.5)";
    ctx.fillRect((i * w) / planks, 0, 2, h);
  }
  return toTexture(c);
}

/** Round white wall clock face. */
export function clockTexture() {
  const s = 256;
  const { c, ctx } = canvas(s, s);
  ctx.fillStyle = "#f6f6f4";
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#222";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.lineWidth = i % 3 === 0 ? 6 : 3;
    ctx.beginPath();
    ctx.moveTo(s / 2 + Math.cos(a) * 98, s / 2 + Math.sin(a) * 98);
    ctx.lineTo(s / 2 + Math.cos(a) * 112, s / 2 + Math.sin(a) * 112);
    ctx.stroke();
  }
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(s / 2, s / 2);
  ctx.lineTo(s / 2 + 45, s / 2 - 35);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s / 2, s / 2);
  ctx.lineTo(s / 2 - 20, s / 2 - 85);
  ctx.stroke();
  return toTexture(c, false);
}

/** ATOM logo print for the characters' clothes (icon + ATOM + GAME CLUB), transparent background. */
export function clothingLogoTexture(color: string, textColor = color) {
  const s = 256;
  const { c, ctx } = canvas(s, s);
  atomIcon(ctx, s / 2, 78, 58, color, 9);
  ctx.textAlign = "center";
  ctx.fillStyle = textColor;
  ctx.font = "900 62px Arial Black, Arial, sans-serif";
  ctx.fillText("ATOM", s / 2, 192);
  ctx.font = "700 28px Arial, sans-serif";
  ctx.fillText("GAME CLUB", s / 2, 232);
  return toTexture(c, false);
}

/** Small atom icon only (headphone cups, shoes, sleeve patch). */
export function atomIconTexture(color: string, bg: string | null = null) {
  const s = 128;
  const { c, ctx } = canvas(s, s);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  atomIcon(ctx, s / 2, s / 2, 46, color, 7);
  return toTexture(c, false);
}

/** Blue kids' carpet with simple playful shapes (the real one has licensed cartoon prints). */
export function carpetTexture() {
  const s = 512;
  const { c, ctx } = canvas(s, s);
  ctx.fillStyle = "#3f7fcf";
  ctx.fillRect(0, 0, s, s);
  const r = rng(9);
  const colors = ["#f7f1e3", "#ffd23f", "#ff8c42", "#7bd389", "#f25f5c"];
  for (let k = 0; k < 60; k++) {
    ctx.fillStyle = colors[k % colors.length];
    ctx.globalAlpha = 0.85;
    const x = r() * s;
    const y = r() * s;
    if (k % 3 === 0) {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 ? 6 : 14;
        ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y, 10 + r() * 18, 8 + r() * 12, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  return toTexture(c);
}

/** Toon shading ramp shared by all character materials. */
export function toonGradient() {
  const data = new Uint8Array([90, 170, 235, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** White safety net in front of the mezzanine (alpha-tested). */
export function netTexture() {
  const s = 256;
  const { c, ctx } = canvas(s, s);
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 7;
  ctx.strokeRect(0, 0, s, s);
  const t = toTexture(c);
  t.anisotropy = 2;
  return t;
}

/** Sign with Persian text (uses the page font, right-to-left). */
export function signTexture(lines: string[], opts: { bg?: string; fg?: string; accent?: string } = {}) {
  const w = 512;
  const h = 256;
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = opts.bg ?? "#111111";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = opts.accent ?? "#00c96b";
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  const family = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif";
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = opts.fg ?? "#ffffff";
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? 800 : 500} ${i === 0 ? 54 : 34}px ${family}`;
    ctx.fillText(line, w / 2, 100 + i * 70);
  });
  return toTexture(c, false);
}

/** Sand / soil with grain noise (construction zone). */
export function soilTexture(base: [number, number, number], spread = 26, seed = 13) {
  const s = 256;
  const { c, ctx } = canvas(s, s);
  const r = rng(seed);
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const n = (r() - 0.5) * spread;
    img.data[i * 4] = base[0] + n;
    img.data[i * 4 + 1] = base[1] + n;
    img.data[i * 4 + 2] = base[2] + n;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let k = 0; k < 40; k++) {
    ctx.fillStyle = `rgba(${base[0] - 30},${base[1] - 30},${base[2] - 30},0.12)`;
    ctx.beginPath();
    ctx.ellipse(r() * s, r() * s, 6 + r() * 30, 4 + r() * 14, r() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return toTexture(c);
}

/** White "FOOTBALLS" lettering on the black top rail of the cage tables. */
export function footballsLabelTexture() {
  const { c, ctx } = canvas(512, 96);
  ctx.fillStyle = "#0c0c0c";
  ctx.fillRect(0, 0, 512, 96);
  ctx.font = "900 italic 64px Arial Black, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f4f4";
  ctx.fillText("FOOTBALLS", 256, 72);
  return toTexture(c, false);
}

/** Flip scoreboard showing 0 0 · 0 0 (as in the photo). */
export function scoreboardTexture() {
  const { c, ctx } = canvas(256, 128);
  ctx.fillStyle = "#151515";
  ctx.fillRect(0, 0, 256, 128);
  ctx.font = "900 84px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "#f2d21b";
  ctx.fillText("0", 48, 100);
  ctx.fillText("0", 208, 100);
  ctx.font = "800 52px Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("0 0", 128, 92);
  return toTexture(c, false);
}

/** White roller-shutter slats. */
export function shutterTexture() {
  const { c, ctx } = canvas(64, 256);
  ctx.fillStyle = "#e9e9e6";
  ctx.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 16) {
    ctx.fillStyle = "#c9c9c4";
    ctx.fillRect(0, y, 64, 3);
    ctx.fillStyle = "#f7f7f4";
    ctx.fillRect(0, y + 3, 64, 2);
  }
  return toTexture(c);
}

/** Persian lettering on a transparent (or coloured) background, right-to-left, page font. */
export function persianTextTexture(
  text: string,
  opts: { width?: number; height?: number; size?: number; fill: string; stroke?: string; strokeWidth?: number; glow?: string; bg?: string; weight?: number },
) {
  const w = opts.width ?? 1024;
  const h = opts.height ?? 256;
  const { c, ctx } = canvas(w, h);
  if (opts.bg) {
    ctx.fillStyle = opts.bg;
    ctx.fillRect(0, 0, w, h);
  }
  const family = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif";
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${opts.weight ?? 900} ${opts.size ?? Math.round(h * 0.62)}px ${family}`;
  if (opts.glow) {
    ctx.shadowColor = opts.glow;
    ctx.shadowBlur = h * 0.12;
  }
  if (opts.stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = opts.strokeWidth ?? h * 0.06;
    ctx.strokeStyle = opts.stroke;
    ctx.strokeText(text, w / 2, h / 2);
  }
  ctx.fillStyle = opts.fill;
  ctx.fillText(text, w / 2, h / 2);
  return toTexture(c, false);
}
