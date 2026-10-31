import { describe, expect, it } from "vitest";
import { organizationSchema } from "@/features/organizations/schemas";

const base = { name: "سازمان نمونه", logoId: "", description: "", terms: "", website: "", showDetails: false, isActive: true };

describe("organizationSchema", () => {
  it("accepts a logo-and-name-only organization and normalises empty fields to null", () => {
    const r = organizationSchema.parse(base);
    expect(r).toMatchObject({ name: "سازمان نمونه", logoId: null, description: null, terms: null, website: null });
  });

  it("needs a description or terms when the details page is on", () => {
    expect(organizationSchema.safeParse({ ...base, showDetails: true }).success).toBe(false);
    expect(organizationSchema.safeParse({ ...base, showDetails: true, terms: "۲۰٪ تخفیف" }).success).toBe(true);
  });

  it("validates the name and website", () => {
    expect(organizationSchema.safeParse({ ...base, name: "ا" }).success).toBe(false);
    expect(organizationSchema.safeParse({ ...base, website: "javascript:alert(1)" }).success).toBe(false);
    expect(organizationSchema.safeParse({ ...base, website: "https://example.ir" }).success).toBe(true);
  });
});
