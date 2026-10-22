import { describe, expect, it } from "vitest";
import { maskIdentifier, normalizeEmail, normalizeIranMobile, parseIdentifier, safeRedirectPath } from "@/lib/identifiers";

describe("normalizeIranMobile", () => {
  it.each([
    ["09121234567", "09121234567"],
    ["9121234567", "09121234567"],
    ["+989121234567", "09121234567"],
    ["00989121234567", "09121234567"],
    ["989121234567", "09121234567"],
    ["۰۹۱۲ ۱۲۳ ۴۵۶۷", "09121234567"],
    ["0912-123-4567", "09121234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeIranMobile(input)).toBe(expected);
  });
  it.each(["0212345678", "0912123456", "091212345678", "abc", "", "08121234567"])("rejects %s", (input) => {
    expect(normalizeIranMobile(input)).toBeNull();
  });
});

describe("normalizeEmail / parseIdentifier", () => {
  it("lowercases and trims emails", () => {
    expect(normalizeEmail("  Reza@Example.COM ")).toBe("reza@example.com");
  });
  it("rejects malformed emails", () => {
    expect(normalizeEmail("reza@")).toBeNull();
    expect(normalizeEmail("a b@c.de")).toBeNull();
  });
  it("detects identifier kind", () => {
    expect(parseIdentifier("reza@example.com")).toEqual({ kind: "email", value: "reza@example.com" });
    expect(parseIdentifier("۰۹۱۲۱۲۳۴۵۶۷")).toEqual({ kind: "phone", value: "09121234567" });
    expect(parseIdentifier("hello")).toBeNull();
  });
  it("masks identifiers", () => {
    expect(maskIdentifier({ kind: "phone", value: "09121234567" })).toBe("0912***4567");
    expect(maskIdentifier({ kind: "email", value: "reza@example.com" })).toBe("re***@example.com");
  });
});

describe("safeRedirectPath", () => {
  it("allows same-site relative paths", () => {
    expect(safeRedirectPath("/account?tab=1")).toBe("/account?tab=1");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", 42, undefined])("blocks %s", (v) => {
    expect(safeRedirectPath(v)).toBe("/");
  });
});

import { describeUserAgent } from "@/lib/user-agent";

describe("describeUserAgent", () => {
  it("summarizes common browsers", () => {
    expect(describeUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36")).toBe("Chrome روی Windows");
    expect(describeUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari روی iOS");
    expect(describeUserAgent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 EdgA/130 Edg/130")).toBe("Edge روی Android");
    expect(describeUserAgent(null)).toBe("دستگاه نامشخص");
  });
});
