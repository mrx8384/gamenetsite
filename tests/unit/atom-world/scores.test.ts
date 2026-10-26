import { beforeEach, describe, expect, it } from "vitest";
import { ACHIEVEMENTS, earned, recordRound } from "../../../src/atom-world/minigames/achievements";
import { addLocal, cleanName, localTop } from "../../../src/atom-world/minigames/scores";
import { parseRewards } from "../../../src/atom-world/data/remoteMachines";

// a tiny in-memory localStorage for the node test environment
beforeEach(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k) },
  };
});

describe("score table", () => {
  it("keeps the 10 best, highest first, and reports the rank", () => {
    for (let i = 1; i <= 12; i++) addLocal("foot-pool", { name: `p${i}`, score: i * 10, detail: "", at: i });
    const top = localTop("foot-pool");
    expect(top.length).toBe(10);
    expect(top[0].score).toBe(120);
    expect(top.at(-1)!.score).toBe(30);
    expect(addLocal("foot-pool", { name: "x", score: 5, detail: "", at: 99 })).toBeNull();
    expect(addLocal("foot-pool", { name: "y", score: 1000, detail: "", at: 100 })).toBe(1);
  });

  it("cleans names (no markup, ≤ 20 characters)", () => {
    expect(cleanName("  <b>علی</b>   رضایی  ")).toBe("bعلی/b رضایی");
    expect(cleanName("ا".repeat(40)).length).toBe(20);
  });

  it("ignores a corrupted stored table", () => {
    window.localStorage.setItem("atom-world:scores:air-hockey", "{not json");
    expect(localTop("air-hockey")).toEqual([]);
  });
});

describe("achievements", () => {
  it("are earned once, from the round's stats", () => {
    const first = recordRound("air-hockey", { won: true, hard: true, against: 0 });
    expect(first.map((a) => a.id).sort()).toEqual(["hockey-clean", "hockey-first-win", "hockey-hard-win"]);
    expect(recordRound("air-hockey", { won: true, hard: true, against: 0 })).toEqual([]);
    expect(Object.keys(earned()).length).toBe(3);
  });

  it("explorer needs all three mini-games", () => {
    recordRound("air-hockey", { won: false });
    recordRound("construction-excavator", { trucks: 0 });
    const last = recordRound("foot-pool", { cleared: false });
    expect(last.map((a) => a.id)).toContain("explorer");
  });

  it("foot-pool efficiency badges need a cleared table", () => {
    expect(recordRound("foot-pool", { cleared: false, kicks: 3, scratches: 0 })).toEqual([]);
    const ids = recordRound("foot-pool", { cleared: true, kicks: 12, scratches: 0 }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["pool-clear", "pool-efficient", "pool-no-scratch"]));
  });

  it("prize texts come only from the club's data, for known achievements", () => {
    expect(parseRewards({ version: 1, rewards: { "hockey-hard-win": "یک دست رایگان", bogus: "x" } })).toEqual({ "hockey-hard-win": "یک دست رایگان" });
    expect(parseRewards({ version: 1 })).toEqual({});
    expect(ACHIEVEMENTS.every((a) => !("prize" in a))).toBe(true);
  });
});
