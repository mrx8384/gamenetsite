import { describe, expect, it } from "vitest";
import { createAccountSchema, licenseTerm, passwordSchema, usernameSchema } from "@/features/gamenet-license/rules";

const day = 86_400_000;
const now = new Date("2026-11-11T12:00:00Z");
const at = (days: number) => new Date(now.getTime() + days * day);

describe("gamenet account rules", () => {
  it("accepts a valid username and rejects bad ones", () => {
    expect(usernameSchema.safeParse("atomclub").success).toBe(true);
    expect(usernameSchema.safeParse("Atom_Club.1").success).toBe(true);
    expect(usernameSchema.safeParse("abc").success).toBe(false); // too short
    expect(usernameSchema.safeParse("1atom").success).toBe(false); // must start with a letter
    expect(usernameSchema.safeParse("اتم‌کلاب").success).toBe(false);
    expect(usernameSchema.safeParse("atom club").success).toBe(false);
  });

  it("requires 8+ chars with upper, lower and a digit, no spaces", () => {
    expect(passwordSchema.safeParse("Atom2026x").success).toBe(true);
    expect(passwordSchema.safeParse("Atom۲۰۲۶x").success).toBe(true); // Persian digits are normalized
    expect(passwordSchema.safeParse("atom2026x").success).toBe(false); // no upper
    expect(passwordSchema.safeParse("ATOM2026X").success).toBe(false); // no lower
    expect(passwordSchema.safeParse("AtomClubX").success).toBe(false); // no digit
    expect(passwordSchema.safeParse("At0m").success).toBe(false); // short
    expect(passwordSchema.safeParse("Atom 2026x").success).toBe(false); // space
  });

  it("checks the confirmation", () => {
    expect(createAccountSchema.safeParse({ username: "atomclub", password: "Atom2026x", confirm: "Atom2026x" }).success).toBe(true);
    const r = createAccountSchema.safeParse({ username: "atomclub", password: "Atom2026x", confirm: "Atom2026y" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("licenseTerm", () => {
  const sub = (status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "INACTIVE", start: number, end: number, features: string[]) => ({ status, startsAt: at(start), endsAt: at(end), features });

  it("uses the latest end of plans that include the software", () => {
    const t = licenseTerm([sub("ACTIVE", -10, 20, ["GAMENET_APP"]), sub("ACTIVE", 20, 200, ["GAMENET_APP", "GAMENET_REMOTE"]), sub("ACTIVE", -5, 400, ["GAMEPAD_TESTER"])], now);
    expect(t.endsAt).toEqual(at(200));
    expect(t.entitled).toBe(true);
    expect(t.remote).toBe(true);
  });

  it("ignores cancelled and unpaid periods", () => {
    const t = licenseTerm([sub("ACTIVE", -10, 20, ["GAMENET_APP"]), sub("CANCELLED", 20, 380, ["GAMENET_APP"]), sub("INACTIVE", 0, 365, ["GAMENET_APP"])], now);
    expect(t.endsAt).toEqual(at(20));
    expect(t.remote).toBe(false);
  });

  it("an ended subscription keeps its end date but is not entitled", () => {
    const t = licenseTerm([sub("EXPIRED", -200, -20, ["GAMENET_APP", "GAMENET_REMOTE"])], now);
    expect(t.endsAt).toEqual(at(-20));
    expect(t.entitled).toBe(false);
    expect(t.remote).toBe(false);
  });

  it("no plan with the software -> nothing", () => {
    expect(licenseTerm([sub("ACTIVE", -1, 30, ["TOURNAMENT_HOST"])], now)).toEqual({ endsAt: null, entitled: false, remote: false });
  });
});
