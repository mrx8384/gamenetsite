import { describe, expect, it } from "vitest";
import { createHockey, stepHockey, TABLE, WIN_SCORE } from "../../../src/atom-world/minigames/airHockey/engine";
import { armPose, BUCKET_CAP, createExcavator, SCENE, stepExcavator, surfaceAt, swing, totalSoil, TRUCK } from "../../../src/atom-world/minigames/excavator/engine";

const idle = { drive: 0, boom: 0, stick: 0, bucket: 0 };

describe("air hockey", () => {
  it("bounces the puck off the side rail and keeps it on the table", () => {
    const s = createHockey();
    s.pause = 0;
    s.puck = { x: 0.3, y: 0, vx: 3, vy: 0.2 };
    s.player.x = s.target.x = -0.4;
    let wall = false;
    for (let i = 0; i < 30; i++) wall ||= stepHockey(s, 1 / 60).some((e) => e.type === "wall");
    expect(wall).toBe(true);
    expect(s.puck.vx).toBeLessThan(0);
    expect(Math.abs(s.puck.x)).toBeLessThanOrEqual(TABLE.W / 2);
  });

  it("counts a goal when the puck enters the computer's goal mouth", () => {
    const s = createHockey();
    s.pause = 0;
    s.ai.x = s.aiTarget.x = 0.4; // out of the way
    s.puck = { x: 0, y: -0.7, vx: 0, vy: -3 };
    s.aiThink = 10;
    let scored = false;
    for (let i = 0; i < 60 && !scored; i++) scored = stepHockey(s, 1 / 60).some((e) => e.type === "goal");
    expect(scored).toBe(true);
    expect(s.score.player).toBe(1);
    expect(s.serve).toBe("ai");
  });

  it("a moving mallet sends the puck forward", () => {
    const s = createHockey();
    s.pause = 0;
    s.puck = { x: 0, y: 0.4, vx: 0, vy: 0 };
    s.player.x = 0;
    s.player.y = 0.7;
    s.target = { x: 0, y: 0.1 };
    let hit = false;
    for (let i = 0; i < 20; i++) hit ||= stepHockey(s, 1 / 60).some((e) => e.type === "hit" && e.by === "player");
    expect(hit).toBe(true);
    expect(s.puck.vy).toBeLessThan(-1);
  });

  it("keeps each mallet in its own half", () => {
    const s = createHockey();
    s.target = { x: 0, y: -0.8 };
    for (let i = 0; i < 120; i++) stepHockey(s, 1 / 60);
    expect(s.player.y).toBeGreaterThan(0);
    expect(s.ai.y).toBeLessThan(0);
  });

  it("the computer wins against a player who does nothing, within a few minutes", () => {
    const s = createHockey("hard");
    for (let i = 0; i < 60 * 240 && !s.over; i++) stepHockey(s, 1 / 60);
    expect(s.over).toBe(true);
    expect(s.score.ai).toBe(WIN_SCORE);
  });
});

describe("excavator", () => {
  /** Drives the controls until `done` or the step budget runs out. */
  function run(s: ReturnType<typeof createExcavator>, c: typeof idle, done: () => boolean, max = 600) {
    for (let i = 0; i < max && !done(); i++) stepExcavator(s, c, 1 / 60);
  }

  it("lowering the open bucket into the pile and curling it fills the bucket", () => {
    const s = createExcavator();
    s.bucket = -0.6; // bucket pointing down
    run(s, { ...idle, boom: -1 }, () => armPose(s).tip.y < surfaceAt(s, armPose(s).tip.x) + 0.01, 400);
    run(s, { ...idle, boom: -1, bucket: -1 }, () => s.load >= BUCKET_CAP * 0.5, 600);
    expect(s.load).toBeGreaterThan(BUCKET_CAP * 0.3);
  });

  it("the bucket never goes through bedrock", () => {
    const s = createExcavator();
    s.bucket = -0.6;
    run(s, { ...idle, boom: -1, stick: 1 }, () => false, 900);
    expect(armPose(s).tip.y).toBeGreaterThanOrEqual(SCENE.bedrock - 1e-6);
  });

  it("soil poured over the truck is delivered and scores", () => {
    const s = createExcavator();
    s.facing = -1;
    s.baseX = 4.3;
    s.boom = 1.1;
    s.stick = -2.28;
    s.bucket = -1.96;
    s.load = BUCKET_CAP;
    const { wrist } = armPose(s);
    expect(wrist.x).toBeGreaterThan(TRUCK.x0 + 0.5);
    expect(wrist.x).toBeLessThan(TRUCK.x1 - 0.5);
    run(s, { ...idle, bucket: 1 }, () => s.load === 0 && s.grains.length === 0, 900);
    expect(s.delivered).toBeGreaterThan(BUCKET_CAP * 0.7);
    expect(s.score).toBeGreaterThan(20);
  });

  it("does not create or lose soil", () => {
    const s = createExcavator();
    const before = totalSoil(s);
    s.bucket = -0.6;
    run(s, { ...idle, boom: -1, bucket: -1 }, () => false, 300);
    run(s, { ...idle, boom: 1, bucket: 1 }, () => false, 300);
    expect(totalSoil(s)).toBeCloseTo(before, 3);
  });

  it("swings to the other side and back", () => {
    const s = createExcavator();
    expect(swing(s)).toBe("ok");
    run(s, idle, () => s.swingT >= 1 && !s.swingPending, 200);
    expect(s.facing).toBe(-1);
    expect(swing(s)).toBe("ok");
    run(s, idle, () => s.swingT >= 1 && !s.swingPending, 200);
    expect(s.facing).toBe(1);
  });

  it("a full bucket can be lifted out of the soil, and swing then lifts it clear by itself", () => {
    const s = createExcavator();
    s.bucket = -0.6;
    run(s, { ...idle, boom: -1 }, () => false, 60);
    run(s, { ...idle, boom: -1, bucket: -1 }, () => false, 90);
    expect(s.load).toBeGreaterThan(BUCKET_CAP * 0.9);
    const boom0 = s.boom;
    run(s, { ...idle, boom: 1 }, () => false, 20);
    expect(s.boom).toBeGreaterThan(boom0); // not stuck
    expect(swing(s)).toBe("ok");
    run(s, idle, () => s.facing === -1 && s.swingT >= 1, 300);
    expect(s.facing).toBe(-1);
    expect(s.load).toBeGreaterThan(BUCKET_CAP * 0.9); // the load stays in the bucket
  });

  it("a full round with the controls only: dig, swing, dump into the truck", () => {
    const s = createExcavator();
    s.bucket = -0.6;
    run(s, { ...idle, boom: -1 }, () => false, 60);
    run(s, { ...idle, boom: -1, bucket: -1 }, () => s.load >= BUCKET_CAP * 0.9, 300);
    swing(s);
    run(s, idle, () => s.facing === -1 && s.swingT >= 1, 300);
    // from the starting spot the swing brings the bucket over the truck bed
    expect(armPose(s).wrist.x).toBeGreaterThan(TRUCK.x0 + 0.3);
    expect(armPose(s).wrist.x).toBeLessThan(TRUCK.x1);
    run(s, { ...idle, bucket: 1 }, () => s.load === 0 && s.grains.length === 0, 600);
    expect(s.delivered).toBeGreaterThan(BUCKET_CAP * 0.5);
  });

  it("ignores a second swing while turning", () => {
    const s = createExcavator();
    swing(s);
    expect(swing(s)).toBe("busy");
  });

  it("ends when the timer runs out", () => {
    const s = createExcavator();
    s.timeLeft = 0.1;
    run(s, idle, () => s.over, 30);
    expect(s.over).toBe(true);
  });
});

describe("air hockey, two players on one device", () => {
  it("the top mallet follows the second player, not the computer", () => {
    const s = createHockey("hard", true);
    s.pause = 0;
    s.target2 = { x: 0.35, y: -0.5 };
    for (let i = 0; i < 60; i++) stepHockey(s, 1 / 60);
    expect(s.ai.x).toBeCloseTo(0.35, 2);
    expect(s.ai.y).toBeCloseTo(-0.5, 2);
  });

  it("each player stays on their own half", () => {
    const s = createHockey("normal", true);
    s.target = { x: 0, y: -0.9 };
    s.target2 = { x: 0, y: 0.9 };
    for (let i = 0; i < 120; i++) stepHockey(s, 1 / 60);
    expect(s.player.y).toBeGreaterThan(0);
    expect(s.ai.y).toBeLessThan(0);
  });

  it("nobody scores by itself when both players stand still", () => {
    const s = createHockey("hard", true);
    for (let i = 0; i < 60 * 30; i++) stepHockey(s, 1 / 60);
    expect(s.score.ai).toBe(0);
  });
});
