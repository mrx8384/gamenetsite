import { describe, expect, it } from "vitest";
import { normalizePersian, parseTomanToRial, SLUG_RE, slugify } from "@/lib/text";

describe("normalizePersian", () => {
  it("unifies Arabic yeh and kaf", () => {
    expect(normalizePersian("كيبورد گيمينگ")).toBe("کیبورد گیمینگ");
  });
});

describe("slugify", () => {
  it.each([
    ["دستهٔ DualSense سفید", "دسته-dualsense-سفید"],
    ["  PS5   Slim  ", "ps5-slim"],
    ["هدست‌ گیمینگ!!", "هدست-گیمینگ"],
    ["FC 26 — نسخهٔ ۲۰۲۶", "fc-26-نسخه-2026"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(SLUG_RE.test(slugify(input))).toBe(true);
  });
  it("rejects invalid slugs", () => {
    expect(SLUG_RE.test("a--b")).toBe(false);
    expect(SLUG_RE.test("-a")).toBe(false);
    expect(SLUG_RE.test("a/b")).toBe(false);
  });
});

describe("parseTomanToRial", () => {
  it.each([
    ["1250000", BigInt(12_500_000)],
    ["۱٬۲۵۰٬۰۰۰", BigInt(12_500_000)],
    ["1,250,000", BigInt(12_500_000)],
    ["0", BigInt(0)],
  ])("%s", (input, expected) => {
    expect(parseTomanToRial(input)).toBe(expected);
  });
  it.each(["", "abc", "-5", "12.5x", "99999999999999"])("rejects %s", (input) => {
    expect(parseTomanToRial(input)).toBeNull();
  });
});

import { isUniqueViolation, uniqueViolationTarget } from "@/lib/action-result";

describe("unique violation helpers", () => {
  it("reads the constraint from Prisma 7 driver-adapter errors", () => {
    const err = { code: "P2002", meta: { driverAdapterError: { cause: { constraint: { index: "products_sku_key" } } } } };
    expect(isUniqueViolation(err)).toBe(true);
    expect(uniqueViolationTarget(err)).toContain("sku");
  });
  it("reads legacy meta.target", () => {
    expect(uniqueViolationTarget({ code: "P2002", meta: { target: ["slug"] } })).toContain("slug");
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});

import { ADMIN_TRANSITIONS, ORDER_STATUS_LABEL } from "@/features/orders/schemas";

describe("order status transitions", () => {
  it("never allows going back to an earlier payment state manually", () => {
    for (const targets of Object.values(ADMIN_TRANSITIONS)) {
      expect(targets).not.toContain("PAID");
      expect(targets).not.toContain("AWAITING_PAYMENT");
    }
  });
  it("shipped orders cannot be cancelled (stock already left)", () => {
    expect(ADMIN_TRANSITIONS.SHIPPED).not.toContain("CANCELLED");
    expect(ADMIN_TRANSITIONS.DELIVERED).not.toContain("CANCELLED");
  });
  it("every status has a Persian label", () => {
    expect(Object.keys(ORDER_STATUS_LABEL).sort()).toEqual(Object.keys(ADMIN_TRANSITIONS).sort());
  });
});
