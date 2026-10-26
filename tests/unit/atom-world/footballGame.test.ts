import { describe, expect, it } from "vitest";
import { createFootball, type FootballInput, type FootballState, GOAL, L, matchResult, stepFootball, W } from "../../../src/atom-world/minigames/football/engine";

const idle: FootballInput = { x: 0, y: 0, shoot: false, pass: false };
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const step = (s: FootballState, sec: number, input: (s: FootballState) => Partial<FootballInput> = () => ({})) => {
  for (let t = 0; t < sec && !s.over; t += 1 / 30) stepFootball(s, 1 / 30, { ...idle, ...input(s) });
};
/** A simple bot for the user's side: chase the ball, run at goal, shoot when close. */
const bot = (s: FootballState): Partial<FootballInput> => {
  const me = s.players[s.controlled];
  const mine = s.ball.owner === me.id;
  const tx = mine ? L : s.ball.x;
  const ty = mine ? W / 2 : s.ball.y;
  const dx = tx - me.x;
  const dy = ty - me.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: -dy / d, shoot: mine && L - me.x < 14 };
};

describe("ATOM football", () => {
  it("kick-off: 3 v 3, the green ATOM striker has the ball, the clock waits", () => {
    const s = createFootball("normal", seeded(3));
    expect(s.players.filter((p) => p.team === 0)).toHaveLength(3);
    expect(s.players.filter((p) => p.role === "gk")).toHaveLength(2);
    expect(s.players[s.ball.owner!].team).toBe(0);
    expect(s.controlled).toBe(s.ball.owner);
    step(s, 1);
    expect(s.left).toBe(120);
  });

  it("dribbling keeps the ball at the player's feet; a shot leaves them", () => {
    const s = createFootball("normal", seeded(3));
    step(s, 2, () => ({ x: 1 }));
    const me = s.players[s.controlled];
    expect(s.ball.owner).toBe(me.id);
    expect(me.x).toBeGreaterThan(L / 2 - 0.5); // the striker starts 1.6 m behind the centre spot
    stepFootball(s, 1 / 30, { ...idle, shoot: true });
    expect(s.ball.owner).toBeNull();
    expect(s.ball.vx).toBeGreaterThan(15);
    expect(s.shots).toBe(1);
  });

  it("a ball into the goal mouth counts, then the other team kicks off", () => {
    const s = createFootball("normal", seeded(3));
    step(s, 2);
    Object.assign(s.ball, { owner: null, x: L - 1, y: W / 2, vx: 20, vy: 0, lastTeam: 0, kick: 99 });
    for (const p of s.players) if (p.team === 1 && p.role === "gk") p.y = W / 2 + GOAL + 3; // keeper out of the way
    step(s, 0.2);
    expect(s.score).toEqual([1, 0]);
    expect(s.players[s.ball.owner!].team).toBe(1);
    expect(s.pause).toBeGreaterThan(0);
  });

  it("outside the goal mouth the ball bounces off the boards", () => {
    const s = createFootball("normal", seeded(3));
    step(s, 2);
    Object.assign(s.ball, { owner: null, x: L - 1, y: 3, vx: 20, vy: 0 });
    step(s, 0.2);
    expect(s.score).toEqual([0, 0]);
    expect(s.ball.x).toBeLessThan(L);
  });

  it("pass goes to the teammate and control switches to him", () => {
    const s = createFootball("normal", seeded(3));
    step(s, 1.7);
    const first = s.controlled;
    stepFootball(s, 1 / 30, { ...idle, pass: true });
    expect(s.controlled).not.toBe(first);
    expect(s.players[s.controlled].role).toBe("field");
  });

  it("standing still, the computer attacks and scores", () => {
    let goals = 0;
    for (const seed of [1, 2, 3]) {
      const s = createFootball("hard", seeded(seed));
      step(s, 300);
      expect(s.over).toBe(true);
      goals += s.score[1];
    }
    expect(goals).toBeGreaterThan(0);
  });

  it("a simple bot can beat the easy computer; full matches stay sane", () => {
    let wins = 0;
    for (const seed of [11, 12, 13, 14]) {
      const s = createFootball("easy", seeded(seed));
      step(s, 300, bot);
      expect(s.over).toBe(true);
      for (const p of s.players) {
        expect(Number.isFinite(p.x) && p.x >= 0 && p.x <= L).toBe(true);
        expect(Number.isFinite(p.y) && p.y >= 0 && p.y <= W).toBe(true);
      }
      const r = matchResult(s);
      expect(r.points).toBeGreaterThanOrEqual(0);
      if (r.won) wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});
