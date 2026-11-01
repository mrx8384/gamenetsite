import { describe, expect, it } from "vitest";
import { guestLimitReached, guestRoundsLeft, parseStatus, type RewardsState, rewardsStore } from "../../../src/atom-world/minigames/rewards";

const state = (p: Partial<RewardsState>): RewardsState => ({ ...rewardsStore.get(), available: true, loggedIn: false, guestRoundsPerGame: 1, guestPlayed: {}, ...p });

describe("visitors without an account", () => {
  it("play each game the number of times the site allows, then must log in", () => {
    expect(guestLimitReached("air-hockey", state({}))).toBe(false);
    expect(guestRoundsLeft("air-hockey", state({}))).toBe(1);
    expect(guestLimitReached("air-hockey", state({ guestPlayed: { "air-hockey": 1 } }))).toBe(true);
    expect(guestLimitReached("gc-city", state({ guestPlayed: { "air-hockey": 1 } }))).toBe(false); // per game
    expect(guestRoundsLeft("air-hockey", state({ guestRoundsPerGame: 3, guestPlayed: { "air-hockey": 1 } }))).toBe(2);
  });
  it("no limit when logged in, when the manager sets 0, or without the site (preview)", () => {
    const played = { guestPlayed: { "air-hockey": 5 } };
    expect(guestLimitReached("air-hockey", state({ ...played, loggedIn: true }))).toBe(false);
    expect(guestLimitReached("air-hockey", state({ ...played, guestRoundsPerGame: 0 }))).toBe(false);
    expect(guestLimitReached("air-hockey", state({ ...played, available: false }))).toBe(false);
    expect(guestRoundsLeft("air-hockey", state({ available: false }))).toBeNull();
  });
  it("the limit comes from the site's answer", () => {
    expect(parseStatus({ guestRoundsPerGame: 2 }).guestRoundsPerGame).toBe(2);
    expect(parseStatus({}).guestRoundsPerGame).toBe(0);
  });
});
