import { beforeEach, describe, expect, it } from "vitest";
import { champion, cleanNames, createTournament, loadTournament, nextMatch, reportResult, roundName, saveTournament } from "../../../src/atom-world/minigames/airHockey/tournament";

beforeEach(() => {
  const mem = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) } };
});

const names8 = ["علی", "سارا", "رضا", "مینا", "امید", "نگار", "پویا", "لیلا"];

describe("friendly air-hockey tournament", () => {
  it("only 4 or 8 players", () => {
    expect(() => createTournament(["a", "b", "c"])).toThrow();
    expect(createTournament(names8.slice(0, 4), 3, false).rounds.map((r) => r.length)).toEqual([2, 1]);
    expect(createTournament(names8, 3, false).rounds.map((r) => r.length)).toEqual([4, 2, 1]);
  });

  it("names: cleaned, unique, defaults for empty ones", () => {
    expect(cleanNames(["<b>علی</b>", "علی", "", "  "])).toEqual(["bعلی/b", "علی", "بازیکن ۳", "بازیکن ۴"]);
    expect(cleanNames(["علی", "علی"])).toEqual(["علی", "علی ۲"]);
  });

  it("winners move on until there is a champion", () => {
    let t = createTournament(names8, 5, false);
    let played = 0;
    for (let m = nextMatch(t); m; m = nextMatch(t)) {
      t = reportResult(t, m.round, m.index, 0, [5, 2]); // player a always wins
      played++;
    }
    expect(played).toBe(7);
    expect(t.players[champion(t)!]).toBe("علی");
    expect(t.rounds[2][0].score).toEqual([5, 2]);
  });

  it("the second match's winner goes to the b side of the next round", () => {
    let t = createTournament(names8.slice(0, 4), 3, false);
    t = reportResult(t, 0, 0, 1, [1, 3]); // سارا
    t = reportResult(t, 0, 1, 0, [3, 0]); // رضا
    expect(t.rounds[1][0]).toMatchObject({ a: 1, b: 2, winner: null });
    expect(nextMatch(t)).toMatchObject({ round: 1, index: 0 });
  });

  it("a decided match can't be reported again", () => {
    let t = createTournament(names8.slice(0, 4), 3, false);
    t = reportResult(t, 0, 0, 0, [3, 1]);
    expect(reportResult(t, 0, 0, 1, [0, 3])).toBe(t);
  });

  it("shuffles with the given random, keeps every player once", () => {
    const t = createTournament(names8, 3, true, () => 0.3);
    expect([...t.players].sort()).toEqual([...names8].sort());
    expect(t.players).not.toEqual(names8);
  });

  it("is saved and restored; junk is ignored", () => {
    const t = createTournament(names8.slice(0, 4));
    saveTournament(t);
    expect(loadTournament()).toEqual(t);
    window.localStorage.setItem("atom-world:hockey-tournament", '{"version":1,"players":["x"]}');
    expect(loadTournament()).toBeNull();
    saveTournament(null);
    expect(loadTournament()).toBeNull();
  });

  it("round names", () => {
    expect([0, 1, 2].map((r) => roundName(r, 3))).toEqual(["یک‌چهارم نهایی", "نیمه‌نهایی", "فینال"]);
  });
});
