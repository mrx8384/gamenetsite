import { describe, expect, it } from "vitest";
import { reserveOpen } from "@/features/tournaments/constants";
import { tournamentSchema } from "@/features/tournaments/schemas";

const base = { reserveEnabled: true, entryFee: "500000", allowSelfRegistration: true, status: "IN_PROGRESS", maxParticipants: 8 };

describe("reserveOpen", () => {
  it("is open while the tournament runs", () => expect(reserveOpen(base, 8)).toBe(true));
  it("is open during registration only when full", () => {
    expect(reserveOpen({ ...base, status: "REGISTRATION" }, 7)).toBe(false);
    expect(reserveOpen({ ...base, status: "REGISTRATION" }, 8)).toBe(true);
    expect(reserveOpen({ ...base, status: "REGISTRATION", maxParticipants: null }, 50)).toBe(false);
  });
  it("needs the switch, an entry fee and online sign-up", () => {
    expect(reserveOpen({ ...base, reserveEnabled: false }, 8)).toBe(false);
    expect(reserveOpen({ ...base, entryFee: "0" }, 8)).toBe(false);
    expect(reserveOpen({ ...base, allowSelfRegistration: false }, 8)).toBe(false);
  });
  it("is closed once finished", () => {
    expect(reserveOpen({ ...base, status: "COMPLETED" }, 8)).toBe(false);
    expect(reserveOpen({ ...base, status: "DRAFT" }, 8)).toBe(false);
  });
});

describe("tournamentSchema reserveEnabled", () => {
  const form = { name: "جام هفتگی اتم", game: "FC 26", format: "SINGLE_ELIMINATION", allowSelfRegistration: true };
  it("requires an entry fee", () => {
    expect(tournamentSchema.safeParse({ ...form, reserveEnabled: true }).success).toBe(false);
    expect(tournamentSchema.parse({ ...form, reserveEnabled: true, entryFeeToman: "50000" }).reserveEnabled).toBe(true);
    expect(tournamentSchema.parse(form).reserveEnabled).toBe(false);
  });
});
