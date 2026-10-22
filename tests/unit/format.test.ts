import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatNumber,
  formatToman,
  rialToToman,
  toEnglishDigits,
  toPersianDigits,
  tomanToRial,
} from "@/lib/format";

describe("digits", () => {
  it("converts ASCII digits to Persian", () => {
    expect(toPersianDigits("ATM-1405")).toBe("ATM-۱۴۰۵");
  });
  it("normalizes Persian and Arabic digits to ASCII", () => {
    expect(toEnglishDigits("۰۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
    expect(toEnglishDigits("٠٩١٢")).toBe("0912");
  });
});

describe("money", () => {
  it("converts between Rial and Toman", () => {
    expect(rialToToman(BigInt(125_000_0))).toBe(BigInt(125_000));
    expect(tomanToRial(125_000)).toBe(BigInt(1_250_000));
  });
  it("formats Rials as Toman with Persian digits and grouping", () => {
    expect(formatToman(BigInt(12_500_000))).toBe("۱٬۲۵۰٬۰۰۰ تومان");
  });
  it("handles values beyond Number.MAX_SAFE_INTEGER", () => {
    expect(formatNumber(BigInt("90071992547409930"))).toBe("۹۰٬۰۷۱٬۹۹۲٬۵۴۷٬۴۰۹٬۹۳۰");
  });
});

describe("dates", () => {
  it("formats in the Jalali calendar, Tehran time", () => {
    // 2026-10-22 08:00 UTC = 30 Mehr 1405 in Tehran
    expect(formatDate(new Date("2026-10-22T08:00:00Z"))).toBe("۳۰ مهر ۱۴۰۵");
  });
});
