import { describe, expect, it } from "vitest";
import {
  achievementPoints,
  codeState,
  computeRound,
  DEFAULT_RULES,
  makeCode,
  normalizeCode,
  orderDiscount,
  parseRules,
  rewardCardSchema,
  roundInputSchema,
  type RoundContext,
  tehranDayStart,
} from "@/features/game-rewards/rules";

const now = new Date("2026-10-27T10:00:00Z");
const ctx = (over: Partial<RoundContext> = {}): RoundContext => ({
  rules: { ...DEFAULT_RULES, perRound: 5, roundsPerDay: 3, minSecondsBetweenRounds: 30 },
  unlocked: new Set(),
  played: new Set(),
  roundsToday: 0,
  lastCountedRoundAt: null,
  now,
  ...over,
});
const round = (game: string, stats: Record<string, number | boolean> = {}) => roundInputSchema.parse({ game, stats, seconds: 60 });

describe("game rewards: rounds", () => {
  it("a round gives its points; the daily cap and the minimum gap stop them", () => {
    expect(computeRound(round("gc-city"), ctx()).roundPoints).toBe(5);
    const capped = computeRound(round("gc-city"), ctx({ roundsToday: 3 }));
    expect(capped).toMatchObject({ roundPoints: 0, capReached: true });
    expect(computeRound(round("gc-city"), ctx({ lastCountedRoundAt: new Date(now.getTime() - 10_000) })).roundPoints).toBe(0);
    expect(computeRound(round("gc-city"), ctx({ lastCountedRoundAt: new Date(now.getTime() - 31_000) })).roundPoints).toBe(5);
    expect(computeRound(round("gc-city"), ctx({ rules: { ...DEFAULT_RULES, enabled: false } })).roundPoints).toBe(0);
  });

  it("achievements are checked on the server from the stats, once each, with the manager's points", () => {
    const stats = { goalsFor: 3, goalsAgainst: 0, won: true, hard: true };
    const first = computeRound(round("gc-football", stats), ctx({ rules: { ...DEFAULT_RULES, achievementPoints: { "ball-win": 500 } } }));
    expect(first.achievements.map((a) => a.id)).toEqual(["ball-first-goal", "ball-win", "ball-hat", "ball-wall"]);
    expect(first.achievements.find((a) => a.id === "ball-win")!.points).toBe(500);
    const again = computeRound(round("gc-football", stats), ctx({ unlocked: new Set(first.achievements.map((a) => a.id)) }));
    expect(again.achievements).toEqual([]);
    // another game's stats never unlock this game's achievements
    expect(computeRound(round("gc-city", stats), ctx()).achievements).toEqual([]);
  });

  it("«play every game» counts the games already on the account", () => {
    const played = new Set(["air-hockey", "construction-excavator", "foot-pool", "gc-controller", "gc-city", "gc-football"] as const);
    const ids = computeRound(round("face-paint"), ctx({ played: new Set(played) })).achievements.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(["explorer", "explorer-all"]));
    expect(computeRound(round("face-paint"), ctx({ played: new Set(played) })).firstOfGame).toBe(true);
    // without the newest game «همهٔ بازی‌ها» is not complete yet
    played.delete("gc-football");
    expect(computeRound(round("face-paint"), ctx({ played: new Set(played) })).achievements.map((a) => a.id)).not.toContain("explorer-all");
  });

  it("only real games and sane stats are accepted", () => {
    expect(roundInputSchema.safeParse({ game: "gc-console", stats: {} }).success).toBe(false);
    expect(roundInputSchema.safeParse({ game: "gc-city", stats: { money: "1000" } }).success).toBe(false);
    expect(roundInputSchema.safeParse({ game: "gc-city", stats: { money: 1e9 } }).success).toBe(false);
    expect(roundInputSchema.safeParse({ game: "gc-city", stats: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 1])) }).success).toBe(false);
  });

  it("rules: bad saved values fall back, unknown achievements are dropped", () => {
    expect(parseRules({ perRound: -5 })).toEqual(DEFAULT_RULES);
    const r = parseRules({ achievementPoints: { "ball-win": 300, gone: 50 } });
    expect(r.achievementPoints).toEqual({ "ball-win": 300 });
    expect(achievementPoints(r, "ball-win")).toBe(300);
    expect(achievementPoints(r, "ball-hat")).toBe(150);
  });

  it("the day starts at midnight in Tehran (UTC+3:30)", () => {
    expect(tehranDayStart(new Date("2026-10-27T10:00:00Z")).toISOString()).toBe("2026-10-26T20:30:00.000Z");
    expect(tehranDayStart(new Date("2026-10-26T20:29:00Z")).toISOString()).toBe("2026-10-25T20:30:00.000Z");
  });
});

describe("game rewards: cards and codes", () => {
  it("codes are ATOM-XXXX-XXXX without look-alike characters; typing is forgiving", () => {
    let i = 0;
    const code = makeCode((max) => i++ % max);
    expect(code).toMatch(/^ATOM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(normalizeCode(" atom ab23 cd45 ")).toBe("ATOM-AB23-CD45");
    expect(normalizeCode("ab23-cd45")).toBe("ATOM-AB23-CD45");
    expect(normalizeCode("ATOM-AB۲۳-CD۴۵")).toBe("ATOM-AB23-CD45");
  });

  it("an active card past its date is expired; used and cancelled stay so", () => {
    expect(codeState({ status: "ACTIVE", expiresAt: new Date(now.getTime() + 1000) }, now)).toBe("ACTIVE");
    expect(codeState({ status: "ACTIVE", expiresAt: new Date(now.getTime() - 1000) }, now)).toBe("EXPIRED");
    expect(codeState({ status: "USED", expiresAt: new Date(now.getTime() - 1000) }, now)).toBe("USED");
  });

  it("online discount: percent of the products, whole Toman, at most 90 %", () => {
    expect(orderDiscount(BigInt(1_234_560), 10)).toBe(BigInt(123_450));
    expect(orderDiscount(BigInt(1_000_000), 100)).toBe(BigInt(900_000));
    expect(orderDiscount(BigInt(1_000_000), 0)).toBe(BigInt(0));
  });

  it("card form: online cards up to 90 %, in-store up to 100 %", () => {
    const base = { title: "کارت ۱۰٪", pointsCost: 1000, discountPercent: 100, validDays: 30 };
    expect(rewardCardSchema.safeParse({ ...base, channel: "IN_STORE" }).success).toBe(true);
    expect(rewardCardSchema.safeParse({ ...base, channel: "ONLINE" }).success).toBe(false);
    expect(rewardCardSchema.safeParse({ ...base, channel: "BOTH", discountPercent: 90 }).success).toBe(true);
    expect(rewardCardSchema.safeParse({ ...base, channel: "BOTH", pointsCost: 0 }).success).toBe(false);
  });
});
