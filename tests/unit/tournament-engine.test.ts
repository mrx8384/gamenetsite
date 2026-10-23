import { describe, expect, it } from "vitest";
import {
  applyResult,
  BracketError,
  clearResult,
  distributeGroups,
  doubleElimination,
  eliminationRoundName,
  groupStage,
  knockoutSeeds,
  type LiveMatch,
  type MatchSpec,
  nextPowerOfTwo,
  resolveByes,
  roundRobin,
  seedOrder,
  singleElimination,
  standings,
  toLive,
} from "@/features/tournaments/engine";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** Deterministic pseudo-random so failures are reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Plays every playable match with random winners until nothing is pending. Returns losses per player. */
function playOut(specs: MatchSpec[], seed: number) {
  const stage = new Map(specs.map((s) => [s.key, s.stage]));
  const live = toLive(specs);
  resolveByes(live);
  const rand = rng(seed);
  const losses = new Map<string, number>();
  const played: LiveMatch[] = [];
  // Simulates the database: only the keys returned by the engine are written back.
  const saved = new Map([...live].map(([k, v]) => [k, { ...v }]));
  const persist = (keys: string[]) => {
    for (const k of keys) saved.set(k, { ...live.get(k)! });
    expect(saved).toEqual(live);
  };
  for (let guard = 0; guard < 1000; guard++) {
    const ready = [...live.values()].find((m) => m.status === "PENDING" && m.player1 && m.player2 && !m.player1Bye && !m.player2Bye);
    if (!ready) break;
    expect(ready.player1).not.toBe(ready.player2);
    const slot: 1 | 2 = rand() < 0.5 ? 1 : 2;
    persist(applyResult(live, ready.key, slot, (k) => stage.get(k)!));
    // Sometimes undo and re-report, exercising clearResult across byes.
    if (rand() < 0.25) {
      persist(clearResult(live, ready.key, (k) => stage.get(k)!));
      persist(applyResult(live, ready.key, slot, (k) => stage.get(k)!));
    }
    const loser = slot === 1 ? ready.player2! : ready.player1!;
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
    played.push(ready);
  }
  return { live, losses, played, stage };
}

describe("seeding", () => {
  it("power of two and standard seed order", () => {
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("single elimination", () => {
  it("gives byes to top seeds", () => {
    const m = singleElimination(players(5));
    const r1 = m.filter((x) => x.round === 1);
    expect(r1).toHaveLength(4);
    expect(r1[0]).toMatchObject({ player1: "p1", player2: null, player2Bye: true });
    expect(m.filter((x) => x.player1Bye || x.player2Bye)).toHaveLength(3);
  });

  for (let n = 2; n <= 20; n++) {
    it(`plays out with ${n} players (+ third place)`, () => {
      const specs = singleElimination(players(n), { thirdPlace: true });
      const { live, losses, stage } = playOut(specs, n);
      const pending = [...live.values()].filter((m) => m.status === "PENDING");
      expect(pending).toHaveLength(0);
      const final = [...live.values()].find((m) => stage.get(m.key) === "WINNERS" && !m.next)!;
      const champion = final.winnerSlot === 1 ? final.player1! : final.player2!;
      expect(losses.get(champion) ?? 0).toBe(0);
      // Everyone else lost once in the main bracket (+ third-place match for semi-final losers).
      for (const p of players(n)) if (p !== champion) expect(losses.get(p)).toBeGreaterThanOrEqual(1);
    });
  }
});

describe("double elimination", () => {
  for (let n = 2; n <= 20; n++) {
    for (const seed of [1, 7, 42]) {
      it(`plays out with ${n} players (seed ${seed})`, () => {
        const specs = doubleElimination(players(n));
        const { live, losses, stage } = playOut(specs, seed * 100 + n);
        expect([...live.values()].filter((m) => m.status === "PENDING")).toHaveLength(0);
        const gf = [...live.values()].find((m) => stage.get(m.key) === "GRAND_FINAL")!;
        const reset = [...live.values()].find((m) => stage.get(m.key) === "GRAND_FINAL_RESET")!;
        const decider = reset.status === "COMPLETED" ? reset : gf;
        const champion = decider.winnerSlot === 1 ? decider.player1! : decider.player2!;
        expect(losses.get(champion) ?? 0).toBeLessThanOrEqual(1);
        for (const p of players(n)) {
          if (p === champion) continue;
          expect(losses.get(p)).toBe(2); // eliminated players lost exactly twice
        }
        if (gf.winnerSlot === 1) expect(reset.status).toBe("SKIPPED");
        else expect(reset.status).toBe("COMPLETED");
      });
    }
  }

  it("losers bracket shape for 8 players", () => {
    const m = doubleElimination(players(8));
    const lb = m.filter((x) => x.stage === "LOSERS");
    expect([1, 2, 3, 4].map((r) => lb.filter((x) => x.round === r).length)).toEqual([2, 2, 1, 1]);
  });
});

describe("results", () => {
  it("re-reporting is allowed until downstream is played; clearing works", () => {
    const specs = singleElimination(players(4));
    const stage = new Map(specs.map((s) => [s.key, s.stage]));
    const live = toLive(specs);
    applyResult(live, "W1-0", 1, (k) => stage.get(k)!);
    expect(live.get("W2-0")!.player1).toBe("p1");
    applyResult(live, "W1-0", 2, (k) => stage.get(k)!); // change winner
    expect(live.get("W2-0")!.player1).toBe("p4");
    applyResult(live, "W1-1", 1, (k) => stage.get(k)!);
    applyResult(live, "W2-0", 1, (k) => stage.get(k)!); // final played
    expect(() => applyResult(live, "W1-0", 1, (k) => stage.get(k)!)).toThrow(BracketError);
    expect(() => clearResult(live, "W1-0", (k) => stage.get(k)!)).toThrow(BracketError);
    clearResult(live, "W2-0", (k) => stage.get(k)!);
    clearResult(live, "W1-0", (k) => stage.get(k)!);
    expect(live.get("W2-0")!.player1).toBeNull();
    expect(live.get("W1-0")!.status).toBe("PENDING");
  });

  it("cannot report a match that is not ready", () => {
    const specs = singleElimination(players(4));
    const live = toLive(specs);
    expect(() => applyResult(live, "W2-0", 1, () => "WINNERS")).toThrow(BracketError);
  });

  it("grand final reset is undone when the grand final result changes", () => {
    const specs = doubleElimination(players(2));
    const stage = new Map(specs.map((s) => [s.key, s.stage]));
    const live = toLive(specs);
    applyResult(live, "W1-0", 1, (k) => stage.get(k)!);
    applyResult(live, "GF", 2, (k) => stage.get(k)!);
    expect(live.get("GFR")!.player1).toBe("p1");
    applyResult(live, "GF", 1, (k) => stage.get(k)!);
    expect(live.get("GFR")!.status).toBe("SKIPPED");
  });
});

describe("round robin and groups", () => {
  for (const n of [2, 3, 4, 5, 8, 9]) {
    it(`${n} players: every pair once, nobody twice per round`, () => {
      const m = roundRobin(players(n));
      expect(m).toHaveLength((n * (n - 1)) / 2);
      const pairs = new Set(m.map((x) => [x.player1, x.player2].sort().join("-")));
      expect(pairs.size).toBe(m.length);
      for (const r of new Set(m.map((x) => x.round))) {
        const inRound = m.filter((x) => x.round === r).flatMap((x) => [x.player1, x.player2]);
        expect(new Set(inRound).size).toBe(inRound.length);
      }
    });
  }
  it("double round robin plays each pair twice with sides swapped", () => {
    const m = roundRobin(players(4), { double: true });
    expect(m).toHaveLength(12);
    expect(m.filter((x) => x.player1 === "p1" && x.player2 === "p2").length + m.filter((x) => x.player1 === "p2" && x.player2 === "p1").length).toBe(2);
  });
  it("snake distribution balances groups", () => {
    expect(distributeGroups(players(8), 2)).toEqual([["p1", "p4", "p5", "p8"], ["p2", "p3", "p6", "p7"]]);
    const g = groupStage(players(10), 3);
    expect(g.groups.map((x) => x.length).sort()).toEqual([3, 3, 4]);
    expect(() => groupStage(players(5), 3)).toThrow();
  });
  it("knockout seeds keep group mates apart", () => {
    expect(knockoutSeeds([["A1", "A2"], ["B1", "B2"]])).toEqual(["A1", "B1", "A2", "B2"]);
    // 4 groups × 2: no first-round match between teams of the same group
    const seeds = knockoutSeeds(["A", "B", "C", "D"].map((g) => [`${g}1`, `${g}2`]));
    const firstRound = singleElimination(seeds).filter((x) => x.round === 1);
    for (const m of firstRound) expect(m.player1![0]).not.toBe(m.player2![0]);
    // first-round pairs: A1 vs A2 must not meet in round 1
    const se = singleElimination(knockoutSeeds([["A1", "A2"], ["B1", "B2"]]));
    const r1 = se.filter((x) => x.round === 1).map((x) => [x.player1, x.player2].sort().join());
    expect(r1).toEqual(["A1,B2", "A2,B1"]);
  });
});

describe("standings", () => {
  const pts = { win: 3, draw: 1, loss: 0 };
  it("orders by points, goal difference, goals for", () => {
    const t = standings(["a", "b", "c"], [
      { player1: "a", player2: "b", score1: 2, score2: 0 },
      { player1: "b", player2: "c", score1: 1, score2: 1 },
      { player1: "c", player2: "a", score1: 3, score2: 1 },
    ], pts);
    expect(t.map((x) => [x.id, x.points, x.goalDiff])).toEqual([["c", 4, 2], ["a", 3, 0], ["b", 1, -2]]);
  });
  it("uses head-to-head when points, GD and GF are equal", () => {
    const t = standings(["a", "b", "c", "d"], [
      { player1: "a", player2: "b", score1: 0, score2: 1 },
      { player1: "a", player2: "c", score1: 1, score2: 0 },
      { player1: "b", player2: "c", score1: 0, score2: 1 },
    ], pts);
    // a, b, c all 3 pts, GD 0, GF 1 → circular; seed order decides; d has 0
    expect(t[3].id).toBe("d");
    const two = standings(["x", "y"], [{ player1: "x", player2: "y", score1: 1, score2: 1 }], pts);
    expect(two.map((s) => s.points)).toEqual([1, 1]);
  });
  it("custom points", () => {
    const t = standings(["a", "b"], [{ player1: "a", player2: "b", score1: 1, score2: 0 }], { win: 2, draw: 1, loss: 0 });
    expect(t[0].points).toBe(2);
  });
});

describe("labels", () => {
  it("names elimination rounds", () => {
    expect(eliminationRoundName(3, 3)).toBe("فینال");
    expect(eliminationRoundName(2, 3)).toBe("نیمه‌نهایی");
    expect(eliminationRoundName(1, 3)).toBe("یک‌چهارم نهایی");
  });
});
