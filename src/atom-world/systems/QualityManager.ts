/** Graphics presets. Phones default to the lighter ones. */
export type QualityLevel = "low" | "medium" | "high";

export interface QualityPreset {
  label: string;
  /** Upper bound for the device pixel ratio. */
  maxDpr: number;
  antialias: boolean;
  shadows: boolean;
  shadowMapSize: number;
  /** Image-based reflections for the glossy floor. */
  envMap: boolean;
  /** Extra fill lights (point lights) under the ceiling. */
  pointLights: boolean;
  /** Max texture size for the mural photos. */
  maxTexture: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: { label: "کم", maxDpr: 1, antialias: false, shadows: false, shadowMapSize: 0, envMap: false, pointLights: false, maxTexture: 512 },
  medium: { label: "متوسط", maxDpr: 1.5, antialias: true, shadows: true, shadowMapSize: 1024, envMap: true, pointLights: false, maxTexture: 1024 },
  high: { label: "زیاد", maxDpr: 2, antialias: true, shadows: true, shadowMapSize: 2048, envMap: true, pointLights: true, maxTexture: 2048 },
};

export const QUALITY_LEVELS: QualityLevel[] = ["low", "medium", "high"];

export interface DeviceHints {
  coarsePointer: boolean;
  /** navigator.deviceMemory in GB, if the browser exposes it. */
  memoryGb?: number;
  cores?: number;
  screenWidth: number;
}

export function isQualityLevel(v: unknown): v is QualityLevel {
  return v === "low" || v === "medium" || v === "high";
}

/** Default preset for a device. Touch devices never start on "high". */
export function detectQuality(h: DeviceHints): QualityLevel {
  const weak = (h.memoryGb !== undefined && h.memoryGb <= 3) || (h.cores !== undefined && h.cores <= 4);
  if (h.coarsePointer) return weak || h.screenWidth < 400 ? "low" : "medium";
  return weak ? "medium" : "high";
}

export function readDeviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
    screenWidth: Math.min(window.screen?.width ?? window.innerWidth, window.innerWidth),
  };
}
