"use client";

import * as React from "react";
import type { ControllerFamily } from "@/features/gamepad-tester/analysis";

/**
 * Live picture of the connected controller in its real shape: pressed buttons light up, sticks move,
 * triggers fill. Sony drawings come from DualShock Calibration GUI (MIT, vendor/dualshock-tools/assets);
 * the Xbox drawing is ours and uses the same `<Name>_infill` / `_outline` convention.
 */

export type PictureModel = "dualsense" | "dualsense-edge" | "dualshock4" | "xbox";

export function pictureModel(family: ControllerFamily, id: string): PictureModel {
  const s = id.toLowerCase();
  if (family === "playstation") {
    if (/0df2|edge/.test(s)) return "dualsense-edge";
    if (/05c4|09cc|dualshock/.test(s)) return "dualshock4";
    return "dualsense";
  }
  return "xbox"; // Xbox and most other pads use the Xbox layout
}

/** Gamepad API "standard" button index → drawing part. */
const PS_PARTS = ["Cross", "Circle", "Square", "Triangle", "L1", "R1", "L2", "R2", "Create", "Options", "L3", "R3", "Up", "Down", "Left", "Right", "PS", "Trackpad"];
const XBOX_PARTS = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "L3", "R3", "Up", "Down", "Left", "Right", "Xbox", "Share"];

const SONY_FILES: Record<Exclude<PictureModel, "xbox">, string> = {
  dualsense: "dualsense-controller.svg",
  "dualsense-edge": "ds-edge-controller.svg",
  dualshock4: "dualshock-controller.svg",
};

/** Xbox face buttons light up in their real colours. */
const XBOX_FACE: Record<string, string> = { A: "#43a047", B: "#e53935", X: "#1e88e5", Y: "#f2b705" };
const COLORS = { body: "#e7e9ec", bodyStroke: "#9aa3ad", outline: "#5d6772", idle: "#ffffff", pressed: "#00c853", trigger: "#ffd400" };

function paint(group: Element | null, color: string) {
  group?.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon").forEach((el) => {
    el.setAttribute("fill", color);
    el.setAttribute("stroke", color);
  });
}

export function ControllerPicture({
  model,
  buttons,
  axes,
}: {
  model: PictureModel;
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
}) {
  const box = React.useRef<HTMLDivElement>(null);
  const [sonySvg, setSonySvg] = React.useState<{ model: PictureModel; markup: string } | null>(null);
  const isSony = model !== "xbox";

  React.useEffect(() => {
    if (!isSony) return;
    let alive = true;
    fetch(`/gamepad-tools/assets/${SONY_FILES[model]}`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((markup) => alive && setSonySvg({ model, markup }))
      .catch(() => alive && setSonySvg(null));
    return () => {
      alive = false;
    };
  }, [isSony, model]);

  // Base colours once per drawing.
  React.useEffect(() => {
    const root = box.current;
    if (!root || !isSony || sonySvg?.model !== model) return;
    // Same parts as the original tool's colouring (core.js), in the site's colours.
    paint(root.querySelector("#Controller"), COLORS.bodyStroke);
    for (const id of ["Button_outlines", "Button_outlines_behind", "L3_outline", "R3_outline", "Trackpad_outline"]) paint(root.querySelector(`#${id}`), COLORS.outline);
    for (const id of ["Controller_infills", "Button_infills", "Button_infills_behind", "L3_infill", "R3_infill", "Trackpad_infill"]) paint(root.querySelector(`#${id}`), COLORS.idle);
  }, [isSony, model, sonySvg]);

  // Live state every render (the tester re-renders each animation frame).
  React.useLayoutEffect(() => {
    const root = box.current;
    if (!root) return;
    const parts = isSony ? PS_PARTS : XBOX_PARTS;
    parts.forEach((name, i) => {
      const b = buttons[i];
      const on = !!b && (b.pressed || b.value > 0.5);
      // Triggers fill with how far they are pulled.
      const analog = (isSony && (name === "L2" || name === "R2")) || (!isSony && (name === "LT" || name === "RT"));
      const pressedColor = (!isSony && XBOX_FACE[name]) || COLORS.pressed;
      const color = analog && b && b.value > 0.02 && !on ? COLORS.trigger : on ? pressedColor : COLORS.idle;
      root.querySelectorAll(`[id="${name}_infill"]`).forEach((g) => paint(g, color));
    });
    const move = (id: string, x: number, y: number) => {
      const g = root.querySelector<SVGGElement>(`#${id}`);
      if (!g) return;
      const base = g.dataset.base ?? g.getAttribute("transform") ?? "";
      g.dataset.base = base;
      g.setAttribute("transform", `translate(${(x * 14).toFixed(1)},${(y * 14).toFixed(1)}) ${base}`);
    };
    move("L3", axes[0] ?? 0, axes[1] ?? 0);
    move("R3", axes[2] ?? 0, axes[3] ?? 0);
  });

  return (
    <div
      ref={box}
      dir="ltr"
      className="mx-auto w-full max-w-md [&_svg]:h-auto [&_svg]:!w-full [&_svg]:!max-w-full"
      role="img"
      aria-label="تصویر زندهٔ دسته"
      // The Sony drawings are our own vendored files (vendor/dualshock-tools/assets), not user input.
      dangerouslySetInnerHTML={isSony && sonySvg?.model === model ? { __html: sonySvg.markup } : undefined}
    >
      {isSony ? (sonySvg?.model === model ? undefined : <div className="aspect-[640/518] animate-pulse rounded-3xl bg-secondary" />) : <XboxSvg buttons={buttons} />}
    </div>
  );
}

/** Xbox Wireless Controller (Series layout): offset sticks, coloured ABXY, guide button, bumpers and triggers. */
function XboxSvg({ buttons }: { buttons: { pressed: boolean; value: number }[] }) {
  const pct = (i: number) => Math.round((buttons[i]?.value ?? 0) * 100);
  const down = (i: number) => !!buttons[i] && (buttons[i]!.pressed || buttons[i]!.value > 0.5);
  const abxy = [
    { id: "Y", cx: 470, cy: 128, color: XBOX_FACE.Y, index: 3 },
    { id: "B", cx: 510, cy: 168, color: XBOX_FACE.B, index: 1 },
    { id: "A", cx: 470, cy: 208, color: XBOX_FACE.A, index: 0 },
    { id: "X", cx: 430, cy: 168, color: XBOX_FACE.X, index: 2 },
  ];
  return (
    <svg viewBox="0 0 640 460" xmlns="http://www.w3.org/2000/svg" strokeWidth={2}>
      {/* Triggers (behind) */}
      <g>
        <g id="LT_infill"><path d="M118 74 C120 40 146 22 180 22 C206 22 220 38 222 62 Z" /></g>
        <g id="RT_infill"><path d="M522 74 C520 40 494 22 460 22 C434 22 420 38 418 62 Z" /></g>
        <path d="M118 74 C120 40 146 22 180 22 C206 22 220 38 222 62 Z M522 74 C520 40 494 22 460 22 C434 22 420 38 418 62 Z" fill="none" stroke={COLORS.outline} />
        <text x="170" y="52" textAnchor="middle" fontSize="15" fontWeight="700" fill={COLORS.outline}>LT {pct(6)}%</text>
        <text x="470" y="52" textAnchor="middle" fontSize="15" fontWeight="700" fill={COLORS.outline}>RT {pct(7)}%</text>
      </g>
      {/* Bumpers */}
      <g id="LB_infill"><path d="M92 104 C112 66 170 54 238 64 L236 82 C176 74 130 82 110 112 Z" /></g>
      <g id="RB_infill"><path d="M548 104 C528 66 470 54 402 64 L404 82 C464 74 510 82 530 112 Z" /></g>
      <path d="M92 104 C112 66 170 54 238 64 L236 82 C176 74 130 82 110 112 Z M548 104 C528 66 470 54 402 64 L404 82 C464 74 510 82 530 112 Z" fill="none" stroke={COLORS.outline} />
      {/* Body */}
      <path
        d="M320 96 C380 96 430 82 470 78 C532 70 574 98 592 156 C614 228 632 316 626 372 C620 418 586 442 552 434 C520 426 500 396 482 360 C466 330 448 316 420 316 L220 316 C192 316 174 330 158 360 C140 396 120 426 88 434 C54 442 20 418 14 372 C8 316 26 228 48 156 C66 98 108 70 170 78 C210 82 260 96 320 96 Z"
        fill={COLORS.body}
        stroke={COLORS.bodyStroke}
        strokeWidth={3}
      />
      {/* Guide, View, Share, Menu */}
      <g id="Xbox_infill"><circle cx="320" cy="132" r="21" /></g>
      <circle cx="320" cy="132" r="21" fill="none" stroke={COLORS.outline} />
      <path d="M309 124 L331 140 M331 124 L309 140" stroke={COLORS.outline} strokeWidth={3} strokeLinecap="round" />
      <g id="View_infill"><circle cx="276" cy="180" r="10" /></g>
      <g id="Menu_infill"><circle cx="364" cy="180" r="10" /></g>
      <g id="Share_infill"><rect x="310" y="196" width="20" height="12" rx="5" /></g>
      <path d="M266 180 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0 M354 180 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0" fill="none" stroke={COLORS.outline} />
      <rect x="310" y="196" width="20" height="12" rx="5" fill="none" stroke={COLORS.outline} />
      {/* Left stick (top-left, offset layout) */}
      <circle cx="176" cy="170" r="48" fill="#cfd4d9" stroke={COLORS.outline} />
      <g id="L3">
        <g id="L3_infill"><circle cx="176" cy="170" r="34" /></g>
        <circle cx="176" cy="170" r="34" fill="none" stroke={COLORS.outline} strokeWidth={3} />
        <circle cx="176" cy="170" r="24" fill="none" stroke={COLORS.outline} strokeDasharray="3 4" />
      </g>
      {/* D-pad */}
      <circle cx="246" cy="262" r="44" fill="#cfd4d9" stroke={COLORS.outline} />
      <g id="Up_infill"><path d="M234 220 h24 v30 l-12 10 l-12 -10 Z" /></g>
      <g id="Down_infill"><path d="M234 304 h24 v-30 l-12 -10 l-12 10 Z" /></g>
      <g id="Left_infill"><path d="M204 250 v24 h30 l10 -12 l-10 -12 Z" /></g>
      <g id="Right_infill"><path d="M288 250 v24 h-30 l-10 -12 l10 -12 Z" /></g>
      <path d="M234 220 h24 v30 l-12 10 l-12 -10 Z M234 304 h24 v-30 l-12 -10 l-12 10 Z M204 250 v24 h30 l10 -12 l-10 -12 Z M288 250 v24 h-30 l-10 -12 l10 -12 Z" fill="none" stroke={COLORS.outline} />
      {/* Right stick */}
      <circle cx="394" cy="262" r="48" fill="#cfd4d9" stroke={COLORS.outline} />
      <g id="R3">
        <g id="R3_infill"><circle cx="394" cy="262" r="34" /></g>
        <circle cx="394" cy="262" r="34" fill="none" stroke={COLORS.outline} strokeWidth={3} />
        <circle cx="394" cy="262" r="24" fill="none" stroke={COLORS.outline} strokeDasharray="3 4" />
      </g>
      {/* ABXY in their real colours */}
      {abxy.map((b) => (
        <g key={b.id}>
          <g id={`${b.id}_infill`}><circle cx={b.cx} cy={b.cy} r="18" /></g>
          <circle cx={b.cx} cy={b.cy} r="18" fill="none" stroke={b.color} strokeWidth={3} />
          <text x={b.cx} y={b.cy + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill={down(b.index) ? "#ffffff" : b.color}>{b.id}</text>
        </g>
      ))}
      <text x="165" y="100" textAnchor="middle" fontSize="13" fontWeight="700" fill={COLORS.outline}>LB</text>
      <text x="475" y="100" textAnchor="middle" fontSize="13" fontWeight="700" fill={COLORS.outline}>RB</text>
    </svg>
  );
}
