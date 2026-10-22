import { describe, expect, it } from "vitest";
import { normalizeInstagram, normalizeIranPhone, partnerApplicationSchema } from "@/features/partners/schemas";
import { evaluateEntitlement, type EntitlementSubject, type SubscriptionPeriod } from "@/features/subscriptions/entitlement-rules";
import { SUBSCRIPTION_PURCHASE_ENABLED } from "@/features/subscriptions/constants";
import { planSchema } from "@/features/subscriptions/schemas";

const day = 86_400_000;
const now = new Date("2026-10-22T12:00:00Z");
const sub = (over: Partial<SubscriptionPeriod> = {}): SubscriptionPeriod => ({
  status: "ACTIVE",
  startsAt: new Date(now.getTime() - day),
  endsAt: new Date(now.getTime() + day),
  features: ["GAMEPAD_TESTER"],
  ...over,
});
const subject = (over: Partial<EntitlementSubject> = {}, partner: Partial<NonNullable<EntitlementSubject["partner"]>> = {}): EntitlementSubject => ({
  role: "PARTNER",
  isActive: true,
  partner: { status: "APPROVED", subscriptions: [sub()], ...partner },
  ...over,
});

describe("entitlements", () => {
  it("grants an approved partner with a current subscription that includes the feature", () => {
    expect(evaluateEntitlement(subject(), "GAMEPAD_TESTER", now)).toBe(true);
  });
  it("denies anonymous, inactive, non-partner and admin users", () => {
    expect(evaluateEntitlement(null, "GAMEPAD_TESTER", now)).toBe(false);
    expect(evaluateEntitlement(subject({ isActive: false }), "GAMEPAD_TESTER", now)).toBe(false);
    expect(evaluateEntitlement(subject({ role: "USER" }), "GAMEPAD_TESTER", now)).toBe(false);
    expect(evaluateEntitlement(subject({ role: "ADMIN" }), "GAMEPAD_TESTER", now)).toBe(false);
  });
  it("denies pending, rejected and suspended partners", () => {
    for (const status of ["PENDING", "REJECTED", "SUSPENDED"] as const) {
      expect(evaluateEntitlement(subject({}, { status }), "GAMEPAD_TESTER", now)).toBe(false);
    }
  });
  it("denies without a current subscription", () => {
    expect(evaluateEntitlement(subject({}, { subscriptions: [] }), "GAMEPAD_TESTER", now)).toBe(false);
    expect(evaluateEntitlement(subject({}, { subscriptions: [sub({ status: "INACTIVE" })] }), "GAMEPAD_TESTER", now)).toBe(false);
    expect(evaluateEntitlement(subject({}, { subscriptions: [sub({ endsAt: new Date(now.getTime() - 1) })] }), "GAMEPAD_TESTER", now)).toBe(false);
    expect(evaluateEntitlement(subject({}, { subscriptions: [sub({ startsAt: new Date(now.getTime() + day) })] }), "GAMEPAD_TESTER", now)).toBe(false);
    expect(evaluateEntitlement(subject({}, { subscriptions: [sub({ startsAt: null })] }), "GAMEPAD_TESTER", now)).toBe(false);
  });
  it("denies when the plan lacks the feature", () => {
    expect(evaluateEntitlement(subject({}, { subscriptions: [sub({ features: [] })] }), "GAMEPAD_TESTER", now)).toBe(false);
  });
  it("purchasing stays disabled", () => {
    expect(SUBSCRIPTION_PURCHASE_ENABLED).toBe(false);
  });
});

describe("partner application", () => {
  const valid = { businessName: "گیم‌نت تست", businessType: "GAME_NET", province: "تهران", city: "تهران", address: "خیابان آزمایشی، پلاک ۱۰", phone: "۰۲۱-۱۲۳۴۵۶۷۸", website: "", instagram: "", description: "" };
  it("normalizes phones (mobile and landline)", () => {
    expect(normalizeIranPhone("۰۹۱۲ ۱۲۳ ۴۵۶۷")).toBe("09121234567");
    expect(normalizeIranPhone("+98 21 1234 5678")).toBe("02112345678");
    expect(normalizeIranPhone("12345")).toBeNull();
    expect(normalizeIranPhone("00000000000")).toBeNull();
  });
  it("normalizes instagram handles and rejects junk", () => {
    expect(normalizeInstagram("@atom.club")).toBe("atom.club");
    expect(normalizeInstagram("https://www.instagram.com/atom_club/")).toBe("atom_club");
    expect(normalizeInstagram("javascript:alert(1)")).toBeNull();
    expect(normalizeInstagram("")).toBe("");
  });
  it("accepts a valid application and normalizes it", () => {
    const r = partnerApplicationSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.phone).toBe("02112345678");
  });
  it("rejects bad province, type, website and short address", () => {
    const r = partnerApplicationSchema.safeParse({ ...valid, province: "پاریس", businessType: "BANK", website: "http://x.com", address: "کوتاه" });
    expect(r.success).toBe(false);
    const paths = new Set(r.error!.issues.map((i) => i.path[0]));
    for (const k of ["province", "businessType", "website", "address"]) expect(paths.has(k)).toBe(true);
  });
  it("rejects javascript: websites", () => {
    expect(partnerApplicationSchema.safeParse({ ...valid, website: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("plan schema", () => {
  it("parses toman price into rial and validates features", () => {
    const r = planSchema.safeParse({ code: "Monthly", name: "ماهانه", priceToman: "۱۵۰٬۰۰۰", durationDays: "۳۰", features: ["GAMEPAD_TESTER"] });
    expect(r.success).toBe(true);
    expect(r.data?.priceToman).toBe(BigInt(1_500_000));
    expect(r.data?.code).toBe("monthly");
  });
  it("rejects unknown features and bad codes", () => {
    expect(planSchema.safeParse({ code: "bad code", name: "x1", priceToman: "0", durationDays: "30", features: [] }).success).toBe(false);
    expect(planSchema.safeParse({ code: "ok", name: "x1", priceToman: "0", durationDays: "30", features: ["ROOT"] }).success).toBe(false);
  });
});
