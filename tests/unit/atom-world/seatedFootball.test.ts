import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../../../src/atom-world/minigames/achievementList";
import { BALL_R, createSeated, FOOT_R, FOOT_Y, GOALS, HALF_L, HALF_W, KICK_REACH, type SeatedState, seatedResult, stepSeated } from "../../../src/atom-world/minigames/seatedFootball/engine";

/** Small deterministic generator. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** A simple player: slides under the ball, kicks when it is in reach (skill 0..1 = how often it reacts). */
function play(s: SeatedState, skill: number, maxSeconds = 600) {
  const dt = 1 / 60;
  const r = rng(99);
  let x = 0;
  let stalled = 0;
  let worstStall = 0;
  for (let t = 0; t < maxSeconds && !s.over; t += dt) {
    const b = s.ball;
    if (r() < skill) x = b.x;
    const ahead = s.me.y - b.y;
    const kick = ahead > 0 && ahead < KICK_REACH + BALL_R + FOOT_R && Math.abs(b.x - s.me.x) < FOOT_R + BALL_R && r() < skill;
    stepSeated(s, dt, { x, kick });
    expect(Math.abs(b.x)).toBeLessThanOrEqual(HALF_W);
    expect(Math.abs(b.y)).toBeLessThanOrEqual(HALF_L + 0.01);
    stalled = s.pause <= 0 && Math.hypot(b.vx, b.vy) < 0.02 ? stalled + dt : 0;
    worstStall = Math.max(worstStall, stalled);
  }
  return worstStall;
}

describe("seated football (FOOTBALLS table)", () => {
  it("a match always ends at 5 goals, and the ball never gets stuck", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      for (const level of ["easy", "normal", "hard"] as const) {
        const s = createSeated(level, rng(seed));
        const stall = play(s, 0.6);
        expect(s.over, `${level}/${seed}`).toBe(true);
        expect(Math.max(s.score.player, s.score.ai)).toBe(GOALS);
        expect(stall).toBeLessThan(2);
      }
    }
  });

  it("a ball nobody stops ends up in that side's goal", () => {
    const s = createSeated("easy", rng(7));
    // the player never moves or kicks; park the foot in a corner
    for (let t = 0; t < 120 && s.score.ai === 0 && !s.over; t += 1 / 60) stepSeated(s, 1 / 60, { x: -HALF_W, kick: false });
    expect(s.score.ai).toBeGreaterThan(0);
  });

  it("a good player beats the easy computer more often than the hard one", () => {
    const wins = (level: "easy" | "hard") => {
      let n = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const s = createSeated(level, rng(seed * 13));
        play(s, 0.75);
        if (s.score.player > s.score.ai) n++;
      }
      return n;
    };
    const easy = wins("easy");
    const hard = wins("hard");
    expect(easy).toBeGreaterThan(hard);
    expect(easy).toBeGreaterThanOrEqual(6);
  });

  it("a kick sends a ball in front of the foot towards the far goal", () => {
    const s = createSeated("normal", rng(3));
    s.pause = 0;
    Object.assign(s.ball, { x: 0, y: FOOT_Y - 0.16, vx: 0, vy: 0 });
    stepSeated(s, 1 / 60, { x: 0, kick: true });
    for (let i = 0; i < 12; i++) stepSeated(s, 1 / 60, { x: 0, kick: false });
    expect(s.ball.vy).toBeLessThan(-0.8);
    expect(s.kicks).toBe(1);
  });

  it("result and achievements", () => {
    const s = createSeated("hard", rng(1));
    s.score = { player: 5, ai: 0 };
    s.elapsed = 60;
    expect(seatedResult(s)).toMatchObject({ won: true, goals: 5, against: 0 });
    const got = (stats: Record<string, number | boolean>) => ACHIEVEMENTS.filter((a) => a.game === "seated-football" && a.test("seated-football", stats, new Set())).map((a) => a.id);
    expect(got({ won: true, hard: false, against: 2 })).toEqual(["seat-first-win"]);
    expect(got({ won: true, hard: true, against: 0 })).toEqual(["seat-first-win", "seat-hard-win", "seat-clean", "seat-golden"]);
    expect(got({ won: false, hard: true, against: 5 })).toEqual([]);
    expect(ACHIEVEMENTS.filter((a) => a.game === "seated-football" && a.hidden)).toHaveLength(1);
  });
});
