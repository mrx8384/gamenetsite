import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type BodyBuild, BUILDS, buildToonCharacter } from "../../../src/atom-world/characters/buildToonCharacter";
import { characters } from "../../../src/atom-world/data/characters";
import { rivalOf } from "../../../src/atom-world/minigames/OpponentIntro";

// the toon model paints a few small decals on a 2D canvas: a no-op canvas is enough here
const noop: unknown = new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : noop), apply: () => noop, set: () => true });
(globalThis as { document?: unknown }).document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) };

const size = (b: BodyBuild) => {
  const rig = buildToonCharacter(characters.boy.look, false, b);
  rig.root.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(rig.root).getSize(new THREE.Vector3());
  rig.dispose();
  return s;
};

describe("visitor body builds", () => {
  const avg = size("average");
  it("heavy is wider, slim is narrower", () => {
    expect(size("heavy").x).toBeGreaterThan(avg.x * 1.1);
    expect(size("slim").x).toBeLessThan(avg.x * 0.95);
  });
  it("heavy has a belly (deeper), tall and short change the height", () => {
    expect(size("heavy").z).toBeGreaterThan(avg.z);
    expect(size("tall").y).toBeGreaterThan(avg.y * 1.08);
    expect(size("short").y).toBeLessThan(avg.y * 0.9);
  });
  it("every build is defined", () => {
    expect(Object.keys(BUILDS).sort()).toEqual(["average", "heavy", "short", "slim", "tall"]);
  });
});

describe("rival character", () => {
  it("is the other ATOM character", () => {
    expect(rivalOf("boy")).toBe("girl");
    expect(rivalOf("girl")).toBe("boy");
  });
});
