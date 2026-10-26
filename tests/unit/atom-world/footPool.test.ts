import { describe, expect, it } from "vitest";
import { aimGuide, BALLS, createPool, cueBall, FIELD, kick, POCKETS, POINTS, stepPool } from "../../../src/atom-world/minigames/footPool/engine";

function settle(s: ReturnType<typeof createPool>, max = 60 * 30) {
  const ev = [];
  for (let i = 0; i < max && s.moving; i++) ev.push(...stepPool(s, 1 / 60));
  return ev;
}

describe("foot-pool", () => {
  it("racks 8 balls plus the white one without overlaps", () => {
    const s = createPool();
    expect(s.balls.length).toBe(BALLS + 1);
    for (const a of s.balls) for (const b of s.balls) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(FIELD.ballR * 2);
  });

  it("a kick rolls the white ball and it comes to rest", () => {
    const s = createPool();
    s.balls.forEach((b) => b.id && (b.inPocket = true)); // empty table
    kick(s, 0, 1, 0.5);
    expect(s.kicks).toBe(1);
    settle(s);
    expect(s.moving).toBe(false);
    expect(Math.abs(cueBall(s).y)).toBeLessThanOrEqual(FIELD.W / 2);
  });

  it("no kick while balls are still rolling", () => {
    const s = createPool();
    kick(s, 1, 0, 0.8);
    expect(kick(s, 1, 0, 0.8)).toEqual([]);
    expect(s.kicks).toBe(1);
  });

  it("the break moves the rack and momentum passes on", () => {
    const s = createPool();
    kick(s, 1, 0, 1);
    const ev = settle(s);
    expect(ev.some((e) => e.type === "ballHit")).toBe(true);
    const moved = s.balls.filter((b) => b.id && (b.inPocket || Math.abs(b.x - FIELD.L / 4) > 0.5)).length;
    expect(moved).toBeGreaterThan(2);
  });

  it("a ball sent straight at a corner pocket is pocketed and scores", () => {
    const s = createPool();
    s.balls.forEach((b) => b.id > 1 && (b.inPocket = true));
    const target = s.balls[1];
    const p = POCKETS[5];
    Object.assign(target, { x: p.x - 0.6, y: p.y - 0.6 });
    Object.assign(cueBall(s), { x: p.x - 1.2, y: p.y - 1.2 });
    kick(s, 1, 1, 0.5);
    const ev = settle(s);
    expect(ev.some((e) => e.type === "pocket" && e.id === 1)).toBe(true);
    expect(s.score).toBe(POINTS.pocket + POINTS.kick);
  });

  it("a pocketed white ball comes back on its spot with a penalty", () => {
    const s = createPool();
    s.balls.forEach((b) => b.id && (b.inPocket = true));
    const p = POCKETS[0];
    Object.assign(cueBall(s), { x: p.x + 0.8, y: p.y + 0.8 });
    kick(s, -1, -1, 0.6);
    const ev = settle(s);
    expect(ev.some((e) => e.type === "scratch")).toBe(true);
    expect(cueBall(s).inPocket).toBe(false);
    expect(s.scratches).toBe(1);
    expect(s.score).toBe(POINTS.kick + POINTS.scratch);
  });

  it("clearing the table ends the game with the bonus", () => {
    const s = createPool();
    s.balls.forEach((b) => b.id > 1 && (b.inPocket = true));
    s.pocketed = BALLS - 1;
    const p = POCKETS[2];
    Object.assign(s.balls[1], { x: p.x - 0.5, y: p.y + 0.5 });
    Object.assign(cueBall(s), { x: p.x - 1.0, y: p.y + 1.0 });
    kick(s, 1, -1, 0.5);
    const ev = settle(s);
    expect(ev.some((e) => e.type === "cleared")).toBe(true);
    expect(s.over).toBe(true);
  });

  it("the aiming guide stops at the first ball in the way", () => {
    const s = createPool();
    const g = aimGuide(s, 1, 0);
    expect(g.hit?.id).toBe(1);
    expect(g.x).toBeCloseTo(s.balls[1].x - FIELD.ballR * 2, 3);
  });
});

describe("foot-pool, two players taking turns", () => {
  it("a miss passes the turn", () => {
    const s = createPool(2);
    s.balls.forEach((b) => b.id && (b.inPocket = true));
    s.pocketed = 0;
    kick(s, 0, 1, 0.3);
    const ev = settle(s);
    expect(ev.some((e) => e.type === "turn" && e.player === 1)).toBe(true);
    expect(s.turn).toBe(1);
  });

  it("pocketing a ball keeps the turn and counts for that player", () => {
    const s = createPool(2);
    s.balls.forEach((b) => b.id > 1 && (b.inPocket = true));
    const p = POCKETS[5];
    Object.assign(s.balls[1], { x: p.x - 0.6, y: p.y - 0.6 });
    Object.assign(cueBall(s), { x: p.x - 1.2, y: p.y - 1.2 });
    kick(s, 1, 1, 0.5);
    settle(s);
    expect(s.turn).toBe(0);
    expect(s.balls2).toEqual([1, 0]);
  });

  it("dropping the white ball passes the turn even after a pocket", () => {
    const s = createPool(2);
    s.turn = 1;
    s.balls.forEach((b) => b.id && (b.inPocket = true));
    const p = POCKETS[0];
    Object.assign(cueBall(s), { x: p.x + 0.8, y: p.y + 0.8 });
    kick(s, -1, -1, 0.6);
    settle(s);
    expect(s.turn).toBe(0);
  });

  it("solo mode never changes the turn", () => {
    const s = createPool(1);
    s.balls.forEach((b) => b.id && (b.inPocket = true));
    kick(s, 0, 1, 0.3);
    settle(s);
    expect(s.turn).toBe(0);
  });
});
