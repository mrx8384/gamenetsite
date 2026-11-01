import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { AUTH_SECRET: "test-secret-".padEnd(40, "x") } }));

import { MIN_ROUND_SECONDS, parseRules, plausibleRound, roundInputSchema } from "@/features/game-rewards/rules";
import { createRoundToken, readRoundToken } from "@/features/game-rewards/round-token";
import { PLAYABLE_GAMES } from "@/atom-world/minigames/achievementList";
import { needsFullLoad } from "@/lib/nav";

describe("game rewards: rounds must be real", () => {
  it("a round token belongs to one user and one game, and cannot be forged", () => {
    const t = createRoundToken("user-1", "air-hockey", 1_000);
    expect(readRoundToken(t, "user-1", "air-hockey")).toMatchObject({ startedAt: 1_000 });
    expect(readRoundToken(t, "user-2", "air-hockey")).toBeNull();
    expect(readRoundToken(t, "user-1", "gc-city")).toBeNull();
    const [, nonce, sig] = t.split(".");
    expect(readRoundToken(`0.${nonce}.${sig}`, "user-1", "air-hockey")).toBeNull(); // earlier start time
    expect(readRoundToken("", "user-1", "air-hockey")).toBeNull();
    expect(createRoundToken("user-1", "air-hockey")).not.toBe(createRoundToken("user-1", "air-hockey"));
  });

  it("every playable game has a minimum round time", () => {
    for (const g of PLAYABLE_GAMES) expect(MIN_ROUND_SECONDS[g], g).toBeGreaterThan(0);
  });

  it("instant or impossible results are refused, normal ones pass", () => {
    // «I won on hard» posted right after starting
    expect(plausibleRound("air-hockey", { won: true, hard: true, goals: 5, against: 0, seconds: 3 }, 3)).toBe(false);
    expect(plausibleRound("air-hockey", { won: true, hard: true, goals: 5, against: 0, seconds: 80 }, 82)).toBe(true);
    expect(plausibleRound("air-hockey", { won: true, goals: 5, seconds: 500 }, 90)).toBe(false); // longer than the round
    expect(plausibleRound("construction-excavator", { trucks: 30 }, 125)).toBe(false);
    expect(plausibleRound("construction-excavator", { trucks: 6 }, 125)).toBe(true);
    expect(plausibleRound("gc-controller", { hits: 40, bestCombo: 30, score: 900 }, 47)).toBe(true);
    expect(plausibleRound("gc-controller", { hits: 5, bestCombo: 30, score: 900 }, 47)).toBe(false);
    expect(plausibleRound("gc-city", { deliveries: 5, money: 700 }, 200)).toBe(true);
    expect(plausibleRound("gc-city", { deliveries: 1, money: 5000 }, 60)).toBe(false);
    expect(plausibleRound("gc-football", { goalsFor: 3, goalsAgainst: 1, won: true }, 125)).toBe(true);
    expect(plausibleRound("gc-football", { goalsFor: 40, won: true }, 125)).toBe(false);
    expect(plausibleRound("face-paint", { faces: 3, best: 95, worst: 88, avg: 91, hard: true }, 70)).toBe(true);
    expect(plausibleRound("face-paint", { faces: 3, best: 100, worst: 100, avg: 100 }, 7)).toBe(false);
    expect(plausibleRound("foot-pool", { cleared: true, kicks: -3 }, 60)).toBe(false);
  });

  it("guest limit: one round per game by default, set by the manager", () => {
    expect(parseRules({}).guestRoundsPerGame).toBe(1);
    expect(parseRules({ guestRoundsPerGame: 0 }).guestRoundsPerGame).toBe(0);
    expect(roundInputSchema.parse({ game: "air-hockey", stats: {} }).token).toBe("");
  });
});

describe("login back into the 3D world", () => {
  it("opens the world with a full page load (its own CSP for the model decoders)", () => {
    expect(needsFullLoad("/atom-world")).toBe(true);
    expect(needsFullLoad("/atom-world?x=1")).toBe(true);
    expect(needsFullLoad("/atom-world/admin")).toBe(true);
    expect(needsFullLoad("/account")).toBe(false);
    expect(needsFullLoad("/atom-worldx")).toBe(false);
  });
});
