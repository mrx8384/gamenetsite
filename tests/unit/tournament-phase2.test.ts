import { describe, expect, it } from "vitest";
import {
  applyResult,
  doubleElimination,
  leaderboardTable,
  pairKey,
  resolveByes,
  type ResultRow,
  standings,
  swissPairings,
  swissRoundCount,
  swissStandings,
  toLive,
} from "@/features/tournaments/engine";
import { tournamentSchema } from "@/features/tournaments/schemas";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const PTS = { win: 3, draw: 1, loss: 0 };

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

/** Runs a whole Swiss event the way the service does: standings → pairings → random results. */
function playSwiss(n: number, rounds: number, seed: number) {
  const ids = players(n);
  const rand = rng(seed);
  const results: ResultRow[] = [];
  const byes: string[] = [];
  const played = new Set<string>();
  const hadBye = new Set<string>();
  const perRound: { pairs: [string, string][]; bye: string | null }[] = [];
  for (let round = 1; round <= rounds; round++) {
    const ranked = round === 1 ? ids : swissStandings(ids, results, byes, PTS).map((s) => s.id);
    const r = swissPairings(ranked, { round, played, hadBye });
    perRound.push(r);
    for (const [a, b] of r.pairs) {
      played.add(pairKey(a, b));
      const x = rand();
      results.push({ player1: a, player2: b, score1: x < 0.45 ? 2 : x < 0.55 ? 1 : 0, score2: x < 0.45 ? 0 : x < 0.55 ? 1 : 2 });
    }
    if (r.bye) {
      byes.push(r.bye);
      hadBye.add(r.bye);
    }
  }
  return { ids, results, byes, perRound };
}

describe("swiss pairings", () => {
  it("round 1 pairs the top half against the bottom half", () => {
    expect(swissPairings(players(8), { round: 1, played: new Set(), hadBye: new Set() })).toEqual({
      pairs: [["p1", "p5"], ["p2", "p6"], ["p3", "p7"], ["p4", "p8"]],
      bye: null,
    });
  });

  for (const n of [2, 3, 5, 8, 9, 16, 17, 33]) {
    for (const seed of [1, 9]) {
      it(`${n} players: everyone plays once per round, no rematches, byes go to different players`, () => {
        const rounds = swissRoundCount(n);
        const { ids, perRound, byes } = playSwiss(n, rounds, seed * 31 + n);
        const seen = new Set<string>();
        for (const { pairs, bye } of perRound) {
          const inRound = pairs.flat().concat(bye ? [bye] : []);
          expect(new Set(inRound).size).toBe(inRound.length);
          expect(inRound.sort()).toEqual([...ids].sort());
          for (const [a, b] of pairs) {
            expect(seen.has(pairKey(a, b))).toBe(false);
            seen.add(pairKey(a, b));
          }
        }
        expect(byes.length).toBe(n % 2 === 1 ? rounds : 0);
        expect(new Set(byes).size).toBe(byes.length);
      });
    }
  }

  it("the bye goes to the lowest-ranked player without one", () => {
    const r = swissPairings(["a", "b", "c", "d", "e"], { round: 2, played: new Set(), hadBye: new Set(["e"]) });
    expect(r.bye).toBe("d");
  });

  it("allows a rematch only when nothing else is possible", () => {
    const r = swissPairings(["a", "b"], { round: 2, played: new Set([pairKey("a", "b")]), hadBye: new Set() });
    expect(r.pairs).toEqual([["a", "b"]]);
  });

  it("recommended rounds", () => {
    expect([2, 4, 8, 9, 16, 64].map(swissRoundCount)).toEqual([1, 2, 3, 4, 4, 6]);
  });
});

describe("swiss standings", () => {
  it("counts a bye as a win and ranks equal points by Buchholz", () => {
    // a beat b, c beat d; a and c have 3 points. a's opponent (b) later beats d → b has 3, d has 0.
    const results: ResultRow[] = [
      { player1: "a", player2: "b", score1: 1, score2: 0 },
      { player1: "c", player2: "d", score1: 1, score2: 0 },
      { player1: "b", player2: "d", score1: 1, score2: 0 },
    ];
    const t = swissStandings(["d", "c", "b", "a", "e"], results, ["e"], PTS);
    const by = new Map(t.map((s) => [s.id, s]));
    expect(by.get("e")).toMatchObject({ points: 3, byes: 1, won: 1, buchholz: 0 });
    expect(by.get("a")!.buchholz).toBe(3);
    expect(by.get("c")!.buchholz).toBe(0);
    expect(t.map((s) => s.id).indexOf("a")).toBeLessThan(t.map((s) => s.id).indexOf("c"));
  });
});

describe("double elimination grand final modes", () => {
  const stages = (n: number, mode: "reset" | "single" | "none") => doubleElimination(players(n), { grandFinal: mode }).map((m) => m.stage);
  it("reset has both grand final games, single only one, none has no grand final", () => {
    for (const n of [2, 5, 8]) {
      expect(stages(n, "reset").filter((s) => s.startsWith("GRAND_FINAL"))).toEqual(["GRAND_FINAL", "GRAND_FINAL_RESET"]);
      expect(stages(n, "single").filter((s) => s.startsWith("GRAND_FINAL"))).toEqual(["GRAND_FINAL"]);
      expect(stages(n, "none").filter((s) => s.startsWith("GRAND_FINAL"))).toEqual([]);
    }
  });

  it("every mode plays out to the end", () => {
    for (const mode of ["single", "none"] as const) {
      for (const n of [3, 6, 8, 11]) {
        const specs = doubleElimination(players(n), { grandFinal: mode });
        const stage = new Map(specs.map((s) => [s.key, s.stage]));
        const live = toLive(specs);
        resolveByes(live);
        for (let i = 0; i < 500; i++) {
          const ready = [...live.values()].find((m) => m.status === "PENDING" && m.player1 && m.player2 && !m.player1Bye && !m.player2Bye);
          if (!ready) break;
          applyResult(live, ready.key, i % 2 === 0 ? 1 : 2, (k) => stage.get(k)!);
        }
        expect([...live.values()].filter((m) => m.status === "PENDING")).toHaveLength(0);
      }
    }
  });
});

describe("tiebreak order", () => {
  // a and b: same points; a has the better goal difference, b won the direct match.
  const results: ResultRow[] = [
    { player1: "b", player2: "a", score1: 1, score2: 0 },
    { player1: "a", player2: "c", score1: 5, score2: 0 },
    { player1: "b", player2: "c", score1: 0, score2: 1 },
    { player1: "a", player2: "d", score1: 1, score2: 0 },
    { player1: "b", player2: "d", score1: 2, score2: 0 },
  ];
  it("goal difference first", () => {
    const t = standings(["a", "b", "c", "d"], results, PTS, "goal_difference");
    expect(t[0].points).toBe(t[1].points);
    expect(t.slice(0, 2).map((s) => s.id)).toEqual(["a", "b"]);
  });
  it("head to head first", () => {
    expect(standings(["a", "b", "c", "d"], results, PTS, "head_to_head").slice(0, 2).map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("leaderboard", () => {
  it("sums points per round and shares ranks on equal totals", () => {
    const t = leaderboardTable(["a", "b", "c", "d"], [
      { participantId: "a", round: 1, points: 10 },
      { participantId: "b", round: 1, points: 4 },
      { participantId: "b", round: 2, points: 6 },
      { participantId: "c", round: 2, points: 3 },
      { participantId: "x", round: 1, points: 99 },
    ]);
    expect(t.map((r) => [r.id, r.total, r.rank])).toEqual([
      ["a", 10, 1],
      ["b", 10, 1],
      ["c", 3, 3],
      ["d", 0, 4],
    ]);
    expect(t[1].byRound.get(2)).toBe(6);
  });
});

describe("form schema", () => {
  const base = { name: "جام تست", game: "FC", format: "SWISS" as const };
  it("defaults and ranges", () => {
    const v = tournamentSchema.parse(base);
    expect(v.grandFinal).toBe("reset");
    expect(v.tiebreak).toBe("goal_difference");
    expect(v.swissRounds).toBeUndefined();
    expect(tournamentSchema.parse({ ...base, swissRounds: "۵" }).swissRounds).toBe(5);
    expect(tournamentSchema.safeParse({ ...base, swissRounds: "30" }).success).toBe(false);
    expect(tournamentSchema.safeParse({ ...base, grandFinal: "twice" }).success).toBe(false);
    expect(tournamentSchema.safeParse({ ...base, format: "LEADERBOARD", leaderboardRounds: "51" }).success).toBe(false);
  });
});
