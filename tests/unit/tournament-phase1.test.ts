import { describe, expect, it } from "vitest";
import { bracketLayout } from "@/features/tournaments/bracket-layout";
import { checkInOpen } from "@/features/tournaments/constants";
import { parseSetScores, singleElimination, standings } from "@/features/tournaments/engine";
import { scoreSchema } from "@/features/tournaments/schemas";

describe("set scores", () => {
  it("parses games/sets in Latin or Persian digits", () => {
    expect(parseSetScores("3-1, 2-3, 5-4")).toEqual({ sets: [[3, 1], [2, 3], [5, 4]], won1: 2, won2: 1, text: "3-1,2-3,5-4" });
    expect(parseSetScores("۳–۱، ۰:۲")).toEqual({ sets: [[3, 1], [0, 2]], won1: 1, won2: 1, text: "3-1,0-2" });
    expect(parseSetScores("")).toBeNull();
    expect(parseSetScores("3-1, abc")).toBe("invalid");
    expect(parseSetScores("1234-1")).toBe("invalid");
  });
  it("result form: sets become the score, forfeit needs a winner", () => {
    expect(scoreSchema.parse({ setScores: "3-1, 2-3, 5-4" })).toMatchObject({ score1: 2, score2: 1, setScores: "3-1,2-3,5-4", forfeit: false });
    expect(scoreSchema.parse({ forfeit: true, winnerSlot: 2 })).toMatchObject({ forfeit: true, winnerSlot: 2, setScores: null });
    expect(scoreSchema.safeParse({ forfeit: true }).success).toBe(false);
    expect(scoreSchema.safeParse({ score1: "2" }).success).toBe(false);
    expect(scoreSchema.parse({ score1: "۲", score2: "1" })).toMatchObject({ score1: 2, score2: 1 });
  });
});

describe("forfeits in standings", () => {
  it("count as a win without goals", () => {
    const t = standings(["a", "b"], [{ player1: "a", player2: "b", score1: 0, score2: 0, winner: 2 }], { win: 3, draw: 1, loss: 0 });
    expect(t[0]).toMatchObject({ id: "b", won: 1, points: 3, goalsFor: 0 });
    expect(t[1]).toMatchObject({ id: "a", lost: 1, points: 0 });
  });
});

describe("check-in window", () => {
  it("opens N minutes before the start", () => {
    const start = new Date("2026-11-10T18:00:00Z");
    expect(checkInOpen(start, 30, new Date("2026-11-10T17:29:00Z"))).toBe(false);
    expect(checkInOpen(start, 30, new Date("2026-11-10T17:30:00Z"))).toBe(true);
    expect(checkInOpen(start, 30, new Date("2026-11-10T18:20:00Z"))).toBe(true);
  });
});

describe("bracket layout", () => {
  it("places each match midway between its feeders, right-to-left, with one line per link", () => {
    const specs = singleElimination(["1", "2", "3", "4", "5", "6", "7", "8"]);
    const matches = specs.map((m) => ({ id: m.key, round: m.round, position: m.position, nextMatchId: m.next?.key ?? null }));
    const size = { w: 200, h: 80, gapX: 40, gapY: 10 };
    const l = bracketLayout(matches, size);
    expect(l.rounds.map((r) => r.round)).toEqual([1, 2, 3]);
    expect(l.width).toBe(3 * 200 + 2 * 40);
    expect(l.rounds[0].x).toBeGreaterThan(l.rounds[2].x); // round 1 on the right
    expect(l.lines).toHaveLength(6);
    const final = matches.find((m) => m.round === 3)!;
    const semis = matches.filter((m) => m.round === 2).map((m) => l.boxes.get(m.id)!.y);
    expect(l.boxes.get(final.id)!.y).toBeCloseTo((semis[0] + semis[1]) / 2);
    // no overlaps inside a column
    for (const r of [1, 2, 3]) {
      const ys = matches.filter((m) => m.round === r).map((m) => l.boxes.get(m.id)!.y).sort((a, b) => a - b);
      ys.slice(1).forEach((y, i) => expect(y - ys[i]).toBeGreaterThanOrEqual(80));
    }
  });
});
