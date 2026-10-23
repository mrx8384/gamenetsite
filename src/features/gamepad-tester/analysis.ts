/**
 * Pure helpers for the Gamepad Tester (no browser APIs here, so they are unit-tested).
 * Input comes from the browser Gamepad API "standard" mapping.
 */

export type ControllerFamily = "playstation" | "xbox" | "generic";

/** Guesses the controller family from Gamepad.id (vendor 054c = Sony, 045e = Microsoft). */
export function controllerFamily(id: string): ControllerFamily {
  const s = id.toLowerCase();
  // Xbox first: "Xbox Wireless Controller" also contains "wireless controller" (Sony's generic name).
  if (/045e|xbox|xinput/.test(s)) return "xbox";
  if (/054c|dualsense|dualshock|playstation|wireless controller/.test(s)) return "playstation";
  return "generic";
}

/** A friendlier model name for known Sony controllers. */
export function controllerModel(id: string): string | null {
  const s = id.toLowerCase();
  if (/0df2|dualsense edge/.test(s)) return "DualSense Edge";
  if (/0ce6|dualsense/.test(s)) return "DualSense (PS5)";
  if (/05c4|09cc|dualshock/.test(s)) return "DualShock 4 (PS4)";
  if (/xbox/.test(s)) return "Xbox Controller";
  return null;
}

const PS_LABELS = ["✕", "○", "□", "△", "L1", "R1", "L2", "R2", "Share", "Options", "L3", "R3", "↑", "↓", "←", "→", "PS", "Touchpad"];
const XBOX_LABELS = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "LS", "RS", "↑", "↓", "←", "→", "Xbox"];

export function buttonLabel(family: ControllerFamily, index: number): string {
  const list = family === "playstation" ? PS_LABELS : family === "xbox" ? XBOX_LABELS : null;
  return list?.[index] ?? `B${index}`;
}

export function magnitude(x: number, y: number): number {
  return Math.min(1.5, Math.hypot(x, y));
}

export type DriftVerdict = "excellent" | "ok" | "drift";

/** Max resting offset of a stick while nobody touches it. Typical healthy sticks stay below 0.05. */
export function driftVerdict(maxRest: number): DriftVerdict {
  if (maxRest < 0.05) return "excellent";
  if (maxRest < 0.12) return "ok";
  return "drift";
}

export const DRIFT_LABELS: Record<DriftVerdict, string> = { excellent: "بدون دریفت", ok: "دریفت جزئی (قابل قبول)", drift: "دریفت دارد" };

export interface CircularityResult {
  /** Share of the 36 angle sectors (10° each) that were reached near the edge. */
  coverage: number;
  /** Average outer radius over reached sectors (1 = full range). */
  avgRadius: number;
  /** Sectors where the stick never got past 0.9 of the range. */
  weakSectors: number;
  verdict: "complete" | "incomplete" | "weak";
}

/**
 * Stick range test: the user rotates the stick along the edge. For each 10° sector we keep the
 * largest radius reached. Healthy sticks reach ~1.0 everywhere (some report up to ~1.1 on diagonals).
 */
export function circularity(points: { x: number; y: number }[]): CircularityResult {
  const sectors = new Array<number>(36).fill(0);
  for (const { x, y } of points) {
    const r = Math.hypot(x, y);
    if (r < 0.3) continue;
    const angle = (Math.atan2(y, x) * 180) / Math.PI + 180; // 0..360
    const i = Math.min(35, Math.floor(angle / 10));
    sectors[i] = Math.max(sectors[i], r);
  }
  const reached = sectors.filter((r) => r >= 0.7);
  const coverage = reached.length / 36;
  const avgRadius = reached.length ? reached.reduce((a, b) => a + b, 0) / reached.length : 0;
  const weakSectors = sectors.filter((r) => r > 0 && r < 0.9).length + (36 - sectors.filter((r) => r > 0).length);
  const verdict = coverage < 0.9 ? "incomplete" : weakSectors > 3 || avgRadius < 0.93 ? "weak" : "complete";
  return { coverage, avgRadius, weakSectors, verdict };
}

export const CIRCULARITY_LABELS: Record<CircularityResult["verdict"], string> = {
  complete: "دامنهٔ حرکت کامل",
  incomplete: "تست کامل نشده (استیک را دور کامل بچرخانید)",
  weak: "دامنهٔ حرکت ناقص",
};
