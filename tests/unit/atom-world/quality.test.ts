import { describe, expect, it } from "vitest";
import { targetPose } from "@/atom-world/characters/CharacterAnimations";
import { machines } from "@/atom-world/data/machines";
import { detectQuality, QUALITY_PRESETS } from "@/atom-world/systems/QualityManager";

describe("quality", () => {
  it("phones never start on high", () => {
    expect(detectQuality({ coarsePointer: true, memoryGb: 8, cores: 8, screenWidth: 412 })).toBe("medium");
    expect(detectQuality({ coarsePointer: true, memoryGb: 2, cores: 8, screenWidth: 412 })).toBe("low");
    expect(detectQuality({ coarsePointer: false, memoryGb: 16, cores: 12, screenWidth: 1920 })).toBe("high");
  });
  it("low preset caps pixel ratio and disables shadows", () => {
    expect(QUALITY_PRESETS.low.maxDpr).toBe(1);
    expect(QUALITY_PRESETS.low.shadows).toBe(false);
  });
});

describe("data", () => {
  it("no machine shows an invented price", () => {
    for (const m of Object.values(machines)) expect(m.price).toBeNull();
  });
});

describe("animation", () => {
  it("walk swings legs in opposite directions", () => {
    const p = targetPose({ state: "walk", time: 0, phase: Math.PI / 2, speed: 2, turnRate: 0, interact: 0 });
    expect(Math.sign(p.thighL)).toBe(-Math.sign(p.thighR));
    expect(Math.sign(p.armL)).toBe(-Math.sign(p.thighL));
  });
});

import { existsSync } from "node:fs";
import { surfaceAt, worldInteractables } from "@/atom-world/data/world";
import { getMachine } from "@/atom-world/data/machines";
import { KIDS_CARPET, STAIRS } from "@/atom-world/data/environment";

describe("world data", () => {
  it("every interactable points at a machine, and every photo exists", () => {
    for (const it of worldInteractables()) {
      const m = getMachine(it.machineId);
      expect(m, it.id).toBeTruthy();
      for (const p of m!.photos) expect(existsSync(`public${p.src}`), p.src).toBe(true);
    }
  });
  it("footstep surfaces", () => {
    expect(surfaceAt(0, 0, 5, false)).toBe("tile");
    expect(surfaceAt((STAIRS.xMin + STAIRS.xMax) / 2, 1, -1, true)).toBe("stairs");
    expect(surfaceAt((KIDS_CARPET.xMin + KIDS_CARPET.xMax) / 2, 0, (KIDS_CARPET.zMin + KIDS_CARPET.zMax) / 2, false)).toBe("carpet");
    expect(surfaceAt(2, -0.68, 16, false)).toBe("street");
  });
});
