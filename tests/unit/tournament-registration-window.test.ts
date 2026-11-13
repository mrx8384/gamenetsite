import { describe, expect, it } from "vitest";
import { registrationPhase } from "@/features/tournaments/constants";
import { tournamentSchema } from "@/features/tournaments/schemas";

const now = new Date("2026-11-13T12:00:00Z");
const h = (n: number) => new Date(now.getTime() + n * 3600_000).toISOString();

describe("registration window", () => {
  it("before / open / closed, each bound optional", () => {
    expect(registrationPhase({ registrationOpensAt: null, registrationClosesAt: null }, now)).toBe("open");
    expect(registrationPhase({ registrationOpensAt: h(1), registrationClosesAt: null }, now)).toBe("before");
    expect(registrationPhase({ registrationOpensAt: h(-1), registrationClosesAt: h(1) }, now)).toBe("open");
    expect(registrationPhase({ registrationOpensAt: null, registrationClosesAt: h(-1) }, now)).toBe("closed");
    expect(registrationPhase({ registrationOpensAt: null, registrationClosesAt: now }, now)).toBe("closed");
  });
  it("form checks the order of the dates", () => {
    const base = { name: "جام تست", game: "FC", format: "SINGLE_ELIMINATION" as const };
    expect(tournamentSchema.safeParse({ ...base, registrationOpensAt: h(1), registrationClosesAt: h(5), startsAt: h(6) }).success).toBe(true);
    const r1 = tournamentSchema.safeParse({ ...base, registrationOpensAt: h(5), registrationClosesAt: h(1) });
    expect(r1.success ? [] : r1.error.issues.map((i) => i.path[0])).toContain("registrationClosesAt");
    const r2 = tournamentSchema.safeParse({ ...base, registrationClosesAt: h(10), startsAt: h(6) });
    expect(r2.success).toBe(false);
  });
});
