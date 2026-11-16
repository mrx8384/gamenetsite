import { describe, expect, it } from "vitest";
import { addDays, amountToPayNow, bookableDays, daySlots, isDayKey, normalizeEnd, parseTime, persianWeekday, shiftStart, tehranDay } from "@/features/booking/rules";
import { shiftSchema } from "@/features/booking/schemas";
import { capForGateway, discountFor, discountProblem, normalizeDiscountCode, type DiscountRule } from "@/features/discounts/rules";
import { discountCodeSchema } from "@/features/discounts/schemas";
import { chooseActiveKey } from "@/features/payments/choose";

const R = (n: number) => BigInt(n);

describe("booking days and times", () => {
  it("maps weekdays to Persian order (0 = شنبه)", () => {
    expect(persianWeekday("2026-11-14")).toBe(0); // Saturday
    expect(persianWeekday("2026-11-20")).toBe(6); // Friday
  });
  it("uses Tehran days", () => {
    expect(tehranDay(new Date("2026-11-15T21:00:00Z"))).toBe("2026-11-16"); // 00:30 Tehran
    expect(tehranDay(new Date("2026-11-15T20:00:00Z"))).toBe("2026-11-15");
    expect(shiftStart("2026-11-16", 18 * 60).toISOString()).toBe("2026-11-16T14:30:00.000Z");
  });
  it("validates day keys and lists bookable days", () => {
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-12-31")).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(bookableDays(new Date("2026-11-15T10:00:00Z"), 3)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17"]);
  });
  it("parses shift times, including after midnight", () => {
    expect(parseTime("۱۸:۳۰")).toBe(1110);
    expect(parseTime("25:00")).toBeNull();
    expect(normalizeEnd(1080, 120)).toBe(1560);
    expect(normalizeEnd(600, 610)).toBeNull();
    expect(normalizeEnd(1080, 480)).toBeNull(); // past 06:00
  });
  it("computes the online amount per payment mode", () => {
    expect(amountToPayNow(R(5_000_000), "ON_SITE", null)).toBe(R(0));
    expect(amountToPayNow(R(5_000_000), "ONLINE_FULL", null)).toBe(R(5_000_000));
    expect(amountToPayNow(R(5_000_000), "DEPOSIT", 30)).toBe(R(1_500_000));
    expect(amountToPayNow(R(20_000), "DEPOSIT", 10)).toBe(R(10_000)); // gateway minimum
    expect(amountToPayNow(R(0), "ONLINE_FULL", null)).toBe(R(0));
  });
  it("marks full, past and closed shifts", () => {
    const shifts = [
      { id: "a", title: "صبح", weekdays: [0, 1], startMinute: 600, endMinute: 840, capacity: 1, isActive: true },
      { id: "b", title: "عصر", weekdays: [0], startMinute: 840, endMinute: 1080, capacity: 2, isActive: true },
      { id: "c", title: "خاموش", weekdays: [0], startMinute: 1080, endMinute: 1440, capacity: 1, isActive: false },
    ];
    const now = new Date("2026-11-14T05:00:00Z"); // 08:30 Tehran, Saturday
    const slots = daySlots("2026-11-14", shifts, { closed: false, now, minHoursBefore: 2, taken: (id) => (id === "b" ? 1 : 0) });
    expect(slots.map((s) => [s.shift.id, s.state, s.left])).toEqual([["a", "past", 1], ["b", "open", 1]]);
    expect(daySlots("2026-11-14", shifts, { closed: true, now, minHoursBefore: 0, taken: () => 0 })[0].state).toBe("closed");
    expect(daySlots("2026-11-14", shifts, { closed: false, now, minHoursBefore: 0, taken: () => 2 })[1].state).toBe("full");
  });
  it("validates the shift form", () => {
    const ok = shiftSchema.parse({ title: "شب", weekdays: [5, 6, 5], start: "18:00", end: "02:00", capacity: "1", priceToman: "۲٬۰۰۰٬۰۰۰", paymentMode: "DEPOSIT", depositPercent: "30" });
    expect(ok).toMatchObject({ weekdays: [5, 6], startMinute: 1080, endMinute: 1560, price: R(20_000_000), depositPercent: 30 });
    expect(shiftSchema.safeParse({ title: "x1", weekdays: [], start: "18:00", end: "20:00", capacity: "1", priceToman: "0", paymentMode: "ON_SITE" }).success).toBe(false);
    expect(shiftSchema.safeParse({ title: "شب", weekdays: [1], start: "18:00", end: "20:00", capacity: "1", priceToman: "500", paymentMode: "ONLINE_FULL" }).success).toBe(false);
  });
});

const rule = (p: Partial<DiscountRule> = {}): DiscountRule => ({ kind: "PERCENT", value: R(20), maxDiscount: null, minAmount: R(0), scopes: ["SHOP", "BOOKING", "TOURNAMENT"], startsAt: null, endsAt: null, usageLimit: null, perUserLimit: 1, isActive: true, ...p });
const ctx = (p = {}) => ({ scope: "SHOP" as const, amount: R(1_000_000), now: new Date("2026-11-15T00:00:00Z"), used: 0, usedByUser: 0, hasUser: true, ...p });

describe("discount codes", () => {
  it("normalizes codes", () => expect(normalizeDiscountCode(" atom ۲۰ ")).toBe("ATOM20"));
  it("computes percent / fixed / capped discounts", () => {
    expect(discountFor(rule(), R(1_000_005))).toBe(R(200_000));
    expect(discountFor(rule({ maxDiscount: R(50_000) }), R(1_000_000))).toBe(R(50_000));
    expect(discountFor(rule({ kind: "FIXED", value: R(300_000) }), R(200_000))).toBe(R(200_000));
  });
  it("keeps the gateway minimum", () => {
    expect(capForGateway(R(100_000), R(100_000))).toBe(R(90_000));
    expect(capForGateway(R(100_000), R(20_000))).toBe(R(20_000));
    expect(capForGateway(R(5_000), R(5_000))).toBe(R(0));
  });
  it("checks scope, dates, limits and minimum amount", () => {
    expect(discountProblem(rule(), ctx())).toBeNull();
    expect(discountProblem(rule({ isActive: false }), ctx())).toMatch("غیرفعال");
    expect(discountProblem(rule({ scopes: ["BOOKING"] }), ctx())).toMatch("فروشگاه");
    expect(discountProblem(rule({ endsAt: new Date("2026-11-01") }), ctx())).toMatch("مهلت");
    expect(discountProblem(rule({ startsAt: new Date("2026-12-01") }), ctx())).toMatch("نرسیده");
    expect(discountProblem(rule({ usageLimit: 5 }), ctx({ used: 5 }))).toMatch("ظرفیت");
    expect(discountProblem(rule(), ctx({ usedByUser: 1 }))).toMatch("قبلاً");
    expect(discountProblem(rule(), ctx({ usedByUser: 1, hasUser: false }))).toBeNull();
    expect(discountProblem(rule({ minAmount: R(2_000_000) }), ctx())).toMatch("حداقل");
  });
  it("parses the admin form", () => {
    const v = discountCodeSchema.parse({ code: "yalda 25", kind: "PERCENT", value: "25", maxDiscountToman: "100000", minAmountToman: "", scopes: ["BOOKING"], usageLimit: "", perUserLimit: "1" });
    expect(v).toMatchObject({ code: "YALDA25", value: R(25), maxDiscount: R(1_000_000), minAmount: R(0), usageLimit: null, perUserLimit: 1 });
    expect(discountCodeSchema.parse({ code: "OFF", kind: "FIXED", value: "50,000", maxDiscountToman: "9", minAmountToman: "", scopes: ["SHOP"], usageLimit: "", perUserLimit: "" })).toMatchObject({ value: R(500_000), maxDiscount: null });
    expect(discountCodeSchema.safeParse({ code: "X", kind: "PERCENT", value: "10", maxDiscountToman: "", minAmountToman: "", scopes: ["SHOP"], usageLimit: "", perUserLimit: "" }).success).toBe(false);
    expect(discountCodeSchema.safeParse({ code: "ABC", kind: "PERCENT", value: "150", maxDiscountToman: "", minAmountToman: "", scopes: ["SHOP"], usageLimit: "", perUserLimit: "" }).success).toBe(false);
  });
});

describe("payment gateway switch", () => {
  it("uses the admin choice, falls back to .env, ignores unconfigured gateways", () => {
    expect(chooseActiveKey(undefined, "bale", ["bale", "sandbox"])).toBe("bale");
    expect(chooseActiveKey("sandbox", "bale", ["bale", "sandbox"])).toBe("sandbox");
    expect(chooseActiveKey(null, "bale", ["bale"])).toBeNull();
    expect(chooseActiveKey("zarinpal", "bale", ["bale"])).toBeNull();
    expect(chooseActiveKey(undefined, "disabled", ["bale"])).toBeNull();
  });
});
