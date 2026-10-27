import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, PLAYABLE_GAMES, type Stats } from "../../../src/atom-world/minigames/achievementList";
import { parseStatus } from "../../../src/atom-world/minigames/rewards";

describe("achievements", () => {
  it("every game: at least 3 visible achievements and exactly one hidden one", () => {
    for (const g of PLAYABLE_GAMES) {
      const list = ACHIEVEMENTS.filter((a) => a.game === g);
      expect(list.filter((a) => !a.hidden).length, g).toBeGreaterThanOrEqual(3);
      expect(list.filter((a) => a.hidden).length, g).toBe(1);
    }
  });

  it("ids are unique, points are positive whole numbers, hidden ones are worth the most", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) expect(Number.isInteger(a.points) && a.points > 0, a.id).toBe(true);
    for (const g of PLAYABLE_GAMES) {
      const list = ACHIEVEMENTS.filter((a) => a.game === g);
      const hidden = list.find((a) => a.hidden)!;
      expect(hidden.points).toBe(Math.max(...list.map((a) => a.points)));
    }
  });

  it("nothing is earned by an empty or nonsense round", () => {
    const played = new Set(PLAYABLE_GAMES.slice(0, 1));
    for (const g of PLAYABLE_GAMES) {
      const rounds: Stats[] = [{}, { won: "yes" as unknown as boolean, goals: Number.NaN }];
      for (const stats of rounds) {
        expect(ACHIEVEMENTS.filter((a) => a.game !== null && a.test(g, stats, played)), g).toEqual([]);
      }
    }
  });

  it("the tests match what the games report", () => {
    const got = (g: (typeof PLAYABLE_GAMES)[number], s: Record<string, number | boolean>) =>
      ACHIEVEMENTS.filter((a) => a.test(g, s, new Set([g]))).map((a) => a.id);
    expect(got("gc-football", { goalsFor: 3, goalsAgainst: 0, won: true, hard: true })).toEqual(["ball-first-goal", "ball-win", "ball-hat", "ball-wall"]);
    expect(got("gc-city", { deliveries: 1, crashes: 2, money: 50 })).toEqual(["city-first"]);
    expect(got("foot-pool", { cleared: true, kicks: 9, scratches: 0 })).toEqual(["pool-clear", "pool-efficient", "pool-no-scratch", "pool-masterpiece"]);
    expect(ACHIEVEMENTS.find((a) => a.id === "explorer-all")!.test("gc-city", {}, new Set(PLAYABLE_GAMES))).toBe(true);
  });
});

describe("site answer for points", () => {
  it("is read defensively", () => {
    const s = parseStatus({
      loggedIn: true,
      enabled: true,
      balance: 1200.7,
      loginUrl: "https://evil.example/login",
      cards: [{ id: "c1", title: "کارت ۱۰٪", pointsCost: 1000, discountPercent: 250, channel: "MOON", validDays: 30 }],
      mine: [{ code: "ATOM-AB12-CD34", title: "x", discountPercent: 10, channel: "ONLINE", status: "WEIRD" }],
      achievements: ["ball-win", 5],
      achievementPoints: { "ball-win": 120, bad: "x" },
    });
    expect(s.balance).toBe(1200);
    expect(s.loginUrl).toBe("/login?next=%2Fatom-world");
    expect(s.cards![0]).toMatchObject({ discountPercent: 100, channel: "IN_STORE" });
    expect(s.mine![0].status).toBe("EXPIRED");
    expect(s.achievements).toEqual(["ball-win"]);
    expect(s.achievementPoints).toEqual({ "ball-win": 120 });
  });
});
