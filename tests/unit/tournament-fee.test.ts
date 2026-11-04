import { describe, expect, it } from "vitest";
import { tournamentSchema } from "@/features/tournaments/schemas";
import { planSchema } from "@/features/subscriptions/schemas";
import { deletionBlocker } from "@/features/users/cleanup";

const base = { name: "جام هفتگی اتم", game: "FC 26", format: "SINGLE_ELIMINATION", allowSelfRegistration: true };

describe("tournament entry fee", () => {
  it("parses Toman (Persian digits, separators) into Rials; empty = free", () => {
    expect(tournamentSchema.parse({ ...base, entryFeeToman: "۵۰٬۰۰۰" }).entryFeeToman).toBe(BigInt(500_000));
    expect(tournamentSchema.parse({ ...base, entryFeeToman: "" }).entryFeeToman).toBe(BigInt(0));
    expect(tournamentSchema.parse(base).entryFeeToman).toBe(BigInt(0));
  });
  it("rejects invalid amounts and a fee without online registration", () => {
    expect(tournamentSchema.safeParse({ ...base, entryFeeToman: "abc" }).success).toBe(false);
    expect(tournamentSchema.safeParse({ ...base, entryFeeToman: "-5" }).success).toBe(false);
    const r = tournamentSchema.safeParse({ ...base, entryFeeToman: "10000", allowSelfRegistration: false });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["entryFeeToman"]);
  });
});

describe("paid plans and records", () => {
  it("plans opt in to online sale", () => {
    const plan = { code: "gold", name: "طلایی", priceToman: "100000", durationDays: "30" };
    expect(planSchema.parse(plan).isActive).toBe(false);
    expect(planSchema.parse({ ...plan, isActive: true }).isActive).toBe(true);
  });
  it("accounts with paid tournament entries are kept", () => {
    expect(deletionBlocker({ role: "USER", orderCount: 0, paidEntryCount: 1 })).toMatch(/تورنومنت/);
    expect(deletionBlocker({ role: "USER", orderCount: 0, paidEntryCount: 0 })).toBeNull();
  });
});

import { formatAutoSku, nextAutoSku } from "@/features/store/sku";
import { productSchema } from "@/features/store/schemas";

describe("automatic product codes", () => {
  it("continues after the highest ATM number and ignores manual codes", () => {
    expect(nextAutoSku([])).toBe("ATM-00001");
    expect(nextAutoSku(["ATM-00009", "ATM-00002", "PS5-PAD", "ATM-X1"])).toBe("ATM-00010");
    expect(formatAutoSku(123456)).toBe("ATM-123456");
  });
  it("accepts an empty code (auto) and still validates manual ones", () => {
    const base = { title: "دسته", slug: "dasteh", price: "1000", compareAtPrice: "", status: "ACTIVE" };
    expect(productSchema.parse({ ...base, sku: "" }).sku).toBe("");
    expect(productSchema.parse({ ...base, sku: "ps5-۱۲" }).sku).toBe("PS5-12");
    expect(productSchema.safeParse({ ...base, sku: "کد" }).success).toBe(false);
  });
});
