import { describe, expect, it } from "vitest";
import { createController, DPAD, DURATION, multiplier, press, step, windowFor } from "../../../src/atom-world/minigames/controller/engine";

const run = (s: ReturnType<typeof createController>, sec: number) => {
  for (let t = 0; t < sec; t += 0.05) step(s, 0.05);
};

describe("controller challenge", () => {
  it("a prompt appears, the right button scores, faster scores more", () => {
    const a = createController("normal", () => 0);
    run(a, 0.5);
    expect(a.prompt).toBe("triangle");
    expect(press(a, "triangle")).toBe("hit");
    const fast = a.score;
    const b = createController("normal", () => 0);
    run(b, 0.5);
    run(b, 1.2);
    press(b, "triangle");
    expect(fast).toBeGreaterThan(b.score);
    expect(fast).toBeLessThanOrEqual(20);
  });

  it("a wrong button or a timeout costs a life and the streak", () => {
    const s = createController("normal", () => 0);
    run(s, 0.5);
    expect(press(s, "circle")).toBe("miss");
    expect(s.lives).toBe(2);
    expect(s.combo).toBe(0);
    run(s, 0.7 + s.window + 0.1);
    expect(s.misses).toBe(2);
    expect(press(s, "cross")).toBe("ignored"); // nothing on the screen yet
  });

  it("the game ends when lives run out or time is up", () => {
    const s = createController("normal", () => 0);
    for (let i = 0; i < 3; i++) {
      run(s, 1);
      if (s.prompt) press(s, s.prompt === "circle" ? "cross" : "circle");
    }
    expect(s.over).toBe(true);
    const t = createController("easy", () => 0.3);
    let guard = 0;
    while (!t.over && guard++ < 10000) {
      step(t, 0.05);
      if (t.prompt) press(t, t.prompt);
    }
    expect(t.left).toBe(0);
    expect(t.hits).toBeGreaterThan(DURATION / 2);
  });

  it("gets faster, rewards streaks, adds the D-pad later on normal", () => {
    expect(windowFor({ difficulty: "normal", hits: 30 })).toBeLessThan(windowFor({ difficulty: "normal", hits: 0 }));
    expect(multiplier(0)).toBe(1);
    expect(multiplier(5)).toBe(1.5);
    expect(multiplier(100)).toBe(3);
    const s = createController("normal", () => 0.99);
    const seen = new Set<string>();
    let guard = 0;
    while (!s.over && guard++ < 5000) {
      step(s, 0.05);
      if (s.prompt) {
        seen.add(s.prompt);
        press(s, s.prompt);
      }
    }
    expect(DPAD.some((d) => seen.has(d))).toBe(true);
    expect(s.bestCombo).toBe(s.hits);
  });
});
