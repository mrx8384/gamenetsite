import { describe, expect, it } from "vitest";
import { doubleElimination, groupStage } from "@/features/tournaments/engine";
import { startPreview } from "@/features/tournaments/preview";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const base = { groupCount: null, doubleRoundRobin: false };

describe("start preview = what the start builds", () => {
  it("single elimination: seed 1 meets the last seed, top seeds get the byes", () => {
    const p = startPreview({ ...base, format: "SINGLE_ELIMINATION" }, ids(8));
    expect(p).toMatchObject({ kind: "pairs" });
    if (p?.kind !== "pairs") return;
    expect(p.pairs).toHaveLength(4);
    expect(p.pairs).toContainEqual({ a: "p1", b: "p8" });
    const five = startPreview({ ...base, format: "SINGLE_ELIMINATION" }, ids(5));
    if (five?.kind !== "pairs") throw new Error();
    expect(five.pairs.filter((x) => x.b === null || x.a === null)).toHaveLength(3); // 8 slots, 3 byes
  });

  it("double elimination preview equals its winners-bracket first round", () => {
    for (const n of [4, 6, 9, 16]) {
      const p = startPreview({ ...base, format: "DOUBLE_ELIMINATION" }, ids(n));
      if (p?.kind !== "pairs") throw new Error();
      const real = doubleElimination(ids(n)).filter((m) => m.stage === "WINNERS" && m.round === 1).sort((a, b) => a.position - b.position).map((m) => ({ a: m.player1, b: m.player2 }));
      expect(p.pairs).toEqual(real);
    }
  });

  it("swapping two players in the list swaps them in the pairs", () => {
    const list = ids(8);
    [list[1], list[7]] = [list[7], list[1]]; // p2 <-> p8
    const p = startPreview({ ...base, format: "SINGLE_ELIMINATION" }, list);
    if (p?.kind !== "pairs") throw new Error();
    expect(p.pairs).toContainEqual({ a: "p1", b: "p2" });
  });

  it("groups and Swiss", () => {
    const g = startPreview({ format: "GROUPS_KNOCKOUT", groupCount: 2, doubleRoundRobin: false }, ids(8));
    expect(g).toEqual({ kind: "groups", groups: groupStage(ids(8), 2).groups });
    expect(startPreview({ format: "GROUPS_KNOCKOUT", groupCount: 4, doubleRoundRobin: false }, ids(6))).toBeNull();
    const s = startPreview({ ...base, format: "SWISS" }, ids(5));
    expect(s).toMatchObject({ kind: "pairs", bye: "p5" });
    expect(startPreview({ ...base, format: "ROUND_ROBIN" }, ids(6))).toBeNull();
    expect(startPreview({ ...base, format: "SINGLE_ELIMINATION" }, ids(1))).toBeNull();
  });
});
