import { describe, expect, it } from "vitest";
import { ZONE_ORIGIN, ZONE_SPAWN } from "@/atom-world/data/constructionZone";
import { buildGroundFloorColliders, HALL, MEZZANINE, SPAWN, STAIRS, type Box } from "@/atom-world/data/environment";
import { FOOT_POOL } from "@/atom-world/data/upperFloor";
import { areaAt, buildWorldColliders } from "@/atom-world/data/world";
import { baseFloorAt, STREET_SPAWN, STREET_Y } from "@/atom-world/data/exterior";
import { type Body, CollisionWorld } from "@/atom-world/systems/CollisionSystem";

const body = (x: number, z: number, y = 0): Body => ({ x, y, z, radius: 0.28, height: 1.65, stepHeight: 0.33 });

/** Walks a body in straight steps like the controller does, applying ground snapping. */
function walk(world: CollisionWorld, b: Body, dx: number, dz: number, steps: number) {
  for (let i = 0; i < steps; i++) {
    b.x += dx;
    b.z += dz;
    world.resolve(b);
    const g = world.groundHeight(b.x, b.z, 0.16, b.y, b.stepHeight);
    // like the controller: step up / glue down within the step height, otherwise fall
    b.y = g >= b.y || b.y - g <= b.stepHeight + 0.02 ? g : Math.max(g, b.y - 0.5);
  }
}

describe("CollisionWorld", () => {
  const wall: Box = { min: [-1, 0, -1], max: [1, 3, 1], tag: "wall" };

  it("pushes a body out of a wall", () => {
    const w = new CollisionWorld([wall]);
    const b = body(1.1, 0);
    expect(w.resolve(b)).toBe(true);
    expect(b.x).toBeCloseTo(1.28, 5);
  });

  it("ignores boxes low enough to step on and reports them as ground", () => {
    const step: Box = { min: [0, 0, 0], max: [1, 0.2, 1], tag: "stairs" };
    const w = new CollisionWorld([step]);
    const b = body(0.5, 0.5);
    expect(w.resolve(b)).toBe(false);
    expect(w.groundHeight(0.5, 0.5, 0.16, 0, 0.33)).toBeCloseTo(0.2);
  });

  it("raycast hits the first box and respects camera flags", () => {
    const furniture: Box = { min: [2, 0, -1], max: [3, 1, 1], tag: "furniture", camera: false };
    const w = new CollisionWorld([wall, furniture]);
    expect(w.raycast(-5, 1, 0, 1, 0, 0, 20)).toBeCloseTo(4);
    expect(w.raycast(1.5, 0.5, 0, 1, 0, 0, 20)).toBe(20);
  });

  it("can disable a tag", () => {
    const barrier: Box = { min: [-1, 0, -1], max: [1, 1, 1], tag: "barrier" };
    const w = new CollisionWorld([barrier]);
    w.setTagEnabled("barrier", false);
    const b = body(0, 0);
    expect(w.resolve(b)).toBe(false);
  });
});

describe("ground floor layout", () => {
  const world = new CollisionWorld(buildWorldColliders(), baseFloorAt);

  it("spawn point is free", () => {
    const b = body(SPAWN.x, SPAWN.z);
    expect(world.resolve(b)).toBe(false);
  });

  it("game starts on the sidewalk; the steps lead up through the doorway into the hall", () => {
    const b = body(STREET_SPAWN.x, STREET_SPAWN.z, STREET_Y);
    expect(world.resolve(b)).toBe(false);
    expect(areaAt(b.x, b.y, b.z)).toBe("street");
    let maxStep = 0;
    for (let i = 0; i < 160; i++) {
      const y0 = b.y;
      walk(world, b, 0, -0.05, 1);
      maxStep = Math.max(maxStep, b.y - y0);
    }
    expect(b.y).toBe(0);
    expect(b.z).toBeLessThan(HALL.halfLength - 3);
    expect(maxStep).toBeLessThanOrEqual(0.18);
    expect(areaAt(b.x, b.y, b.z)).toBe("ground");
  });

  it("the shop window blocks entering anywhere but the doorway", () => {
    const b = body(-2, STREET_SPAWN.z, STREET_Y);
    walk(world, b, 0, -0.05, 120);
    expect(b.z).toBeGreaterThan(HALL.halfLength);
    expect(b.y).toBe(STREET_Y);
  });

  it("walls keep the player inside the hall", () => {
    const b = body(0, 0);
    walk(world, b, 0.1, 0, 200);
    expect(b.x).toBeLessThanOrEqual(HALL.halfWidth - 0.27);
    const c = body(-0.3, 11);
    walk(world, c, 0, 0.1, 100);
    expect(c.z).toBeLessThanOrEqual(HALL.halfLength - 0.27);
  });

  it("the optional phase-1 barrier still blocks the stairs", () => {
    const closed = new CollisionWorld(buildGroundFloorColliders({ stairsOpen: false }));
    const b = body((STAIRS.xMin + STAIRS.xMax) / 2, STAIRS.zStart + 1.0);
    walk(closed, b, 0, -0.05, 120);
    expect(b.y).toBe(0);
    expect(b.z).toBeGreaterThan(STAIRS.zStart);
  });

  it("the stairs are climbable step by step up to the upper floor (no teleport)", () => {
    const b = body((STAIRS.xMin + STAIRS.xMax) / 2 + 0.05, STAIRS.zStart + 0.6);
    let maxStep = 0;
    for (let i = 0; i < 120; i++) {
      const y0 = b.y;
      walk(world, b, 0, -0.05, 1);
      maxStep = Math.max(maxStep, b.y - y0);
    }
    expect(b.y).toBeCloseTo(MEZZANINE.top, 2);
    expect(maxStep).toBeLessThanOrEqual(STAIRS.rise + 1e-6);
    expect(areaAt(b.x, b.y)).toBe("upper");
  });

  it("the net keeps the player on the upper floor", () => {
    const b = body(-2, -6, MEZZANINE.top);
    walk(world, b, 0, 0.1, 60);
    expect(b.z).toBeLessThan(MEZZANINE.zFront);
    expect(b.y).toBeCloseTo(MEZZANINE.top);
  });

  it("the foot-pool field blocks walking through it", () => {
    const b = body((FOOT_POOL.xMin + FOOT_POOL.xMax) / 2, FOOT_POOL.zMax + 1, MEZZANINE.top);
    walk(world, b, 0, -0.05, 80);
    expect(b.z).toBeGreaterThan(FOOT_POOL.zMax);
  });

  it("construction zone: free spawn, counters stop the player at the pit", () => {
    const b = body(ZONE_ORIGIN.x + ZONE_SPAWN.x, ZONE_ORIGIN.z + ZONE_SPAWN.z);
    expect(world.resolve(b)).toBe(false);
    expect(areaAt(b.x, b.y, b.z)).toBe("zone");
    walk(world, b, 0, -0.05, 80);
    expect(b.z).toBeGreaterThan(ZONE_ORIGIN.z + 0.9);
    expect(b.y).toBe(0);
  });
});

describe("ceilings never throw the player out of the building", () => {
  // jumping on the upper-floor foot-pool field puts the head into the hall's ceiling slab
  const world = new CollisionWorld(buildGroundFloorColliders());
  it("a head inside the ceiling slab is not pushed sideways", () => {
    const body = { x: -2, y: HALL.height - 1.2, z: -11, radius: 0.3, height: 1.65, stepHeight: 0.33 };
    world.resolve(body);
    expect([body.x, body.z]).toEqual([-2, -11]);
  });
  it("finds the ceiling above the head (the jump stops there)", () => {
    expect(world.ceilingAbove(-2, -11, 0.25, 3.35 + 1.65)).toBeCloseTo(HALL.height);
    // under the mezzanine, from the ground floor, the slab underside is the ceiling
    expect(world.ceilingAbove(-2, -11, 0.25, 1.65)).toBeCloseTo(MEZZANINE.top - MEZZANINE.thickness);
  });
});
