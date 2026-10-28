import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS } from "../../../src/atom-world/minigames/achievementList";
import {
  CUSTOMERS,
  createFacePaint,
  dab,
  DESIGNS,
  finishFace,
  GRID,
  insideFace,
  match,
  rasterize,
  roundStats,
  stepFacePaint,
  stroke,
  TIME,
} from "../../../src/atom-world/minigames/facePaint/engine";

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe("face painting rules", () => {
  it("every design has paint inside the face (and nothing outside it)", () => {
    for (const d of DESIGNS) {
      const g = rasterize(d);
      const cells = g.reduce((a, v) => a + (v ? 1 : 0), 0);
      expect(cells, d.id).toBeGreaterThan(25);
      g.forEach((v, i) => v && expect(insideFace(((i % GRID) + 0.5) / GRID, (Math.floor(i / GRID) + 0.5) / GRID)).toBe(true));
    }
  });

  it("exact copy = 100 %, nothing painted = 0 %, wrong colour scores low", () => {
    const t = rasterize(DESIGNS[0]);
    expect(match(t, t.slice())).toBe(100);
    expect(match(t, new Uint8Array(t.length))).toBe(0);
    const wrong = t.map((v) => (v ? (v % 9) + 1 : 0));
    expect(match(t, wrong)).toBe(0);
  });

  it("painting over the whole face does not win", () => {
    const t = rasterize(DESIGNS.find((d) => d.id === "heart")!);
    const all = new Uint8Array(t.length);
    for (let v = 0; v < 1; v += 0.02) stroke(all, [0, v], [1, v], 0.03, 1);
    expect(match(t, all)).toBeLessThan(40);
  });

  it("a careful brush copy is close", () => {
    const d = DESIGNS.find((x) => x.id === "star")!;
    const t = rasterize(d);
    const p = new Uint8Array(t.length);
    t.forEach((v, i) => v && dab(p, ((i % GRID) + 0.5) / GRID, (Math.floor(i / GRID) + 0.5) / GRID, 0.012, v));
    expect(match(t, p)).toBeGreaterThanOrEqual(85);
  });

  it("three different children per round, timer and results", () => {
    const s = createFacePaint("normal", seq([0.1, 0.5, 0.9, 0.3]));
    expect(s.customers).toHaveLength(CUSTOMERS);
    expect(new Set(s.customers.map((c) => c.design.id)).size).toBe(CUSTOMERS);
    s.painted.set(s.customers[0].target);
    const r = finishFace(s)!;
    expect(r.percent).toBe(100);
    expect(r.points).toBe(1000 + TIME.normal * 3);
    expect(finishFace(s)).toBeNull(); // not twice
    stepFacePaint(s, 3);
    expect(s.index).toBe(1);
    expect(s.painted.every((v) => v === 0)).toBe(true);
    // time runs out on the second child: scored as it is (empty face)
    stepFacePaint(s, TIME.normal + 1);
    expect(s.results[1].percent).toBe(0);
    stepFacePaint(s, 3);
    s.painted.set(s.customers[2].target);
    finishFace(s);
    stepFacePaint(s, 3);
    expect(s.over).toBe(true);
    const st = roundStats(s);
    expect(st).toMatchObject({ faces: 3, best: 100, worst: 0, avg: 67, hard: false });
  });

  it("achievements follow the round stats", () => {
    const got = (stats: Record<string, number | boolean>) =>
      ACHIEVEMENTS.filter((a) => a.game === "face-paint" && a.test("face-paint", stats, new Set())).map((a) => a.id);
    expect(got({ faces: 3, best: 50, worst: 20, hard: false })).toEqual(["paint-first"]);
    expect(got({ faces: 3, best: 90, worst: 70, hard: false })).toEqual(["paint-first", "paint-artist", "paint-happy"]);
    expect(got({ faces: 3, best: 95, worst: 88, hard: true })).toContain("paint-master");
    expect(ACHIEVEMENTS.filter((a) => a.game === "face-paint" && a.hidden)).toHaveLength(1);
  });
});
