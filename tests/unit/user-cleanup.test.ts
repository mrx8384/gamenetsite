import { describe, expect, it } from "vitest";
import { accountsSettingsSchema, deletionBlocker, inactiveCutoff, inactiveUsersWhere } from "@/features/users/cleanup";

describe("account deletion rules", () => {
  it("allows deleting an ordinary account without orders", () => {
    expect(deletionBlocker({ role: "USER", orderCount: 0, hasPartnerProfile: false })).toBeNull();
    expect(deletionBlocker({ role: "SUPPORT", orderCount: 0, hasPartnerProfile: false })).toBeNull();
  });
  it("keeps admins, partners and customers with orders", () => {
    expect(deletionBlocker({ role: "ADMIN", orderCount: 0, hasPartnerProfile: false })).toMatch(/مدیر/);
    expect(deletionBlocker({ role: "USER", orderCount: 0, hasPartnerProfile: true })).toMatch(/همکار/);
    expect(deletionBlocker({ role: "USER", orderCount: 2, hasPartnerProfile: false })).toMatch(/سفارش/);
  });
});

describe("inactive account cleanup", () => {
  it("is off by default and only accepts the offered periods", () => {
    expect(accountsSettingsSchema.parse({}).inactiveDeleteMonths).toBe(0);
    expect(accountsSettingsSchema.safeParse({ inactiveDeleteMonths: 1 }).success).toBe(false);
    expect(accountsSettingsSchema.parse({ inactiveDeleteMonths: "12" }).inactiveDeleteMonths).toBe(12);
  });
  it("computes the cutoff in months", () => {
    expect(inactiveCutoff(12, new Date("2026-10-31T00:00:00Z")).toISOString().slice(0, 10)).toBe("2025-10-31");
  });
  it("only ever targets ordinary users without orders or partner profile", () => {
    const w = inactiveUsersWhere(new Date("2025-01-01"));
    expect(w.role).toBe("USER");
    expect(w.orders).toEqual({ none: {} });
    expect(w.partnerProfile).toEqual({ is: null });
  });
});
