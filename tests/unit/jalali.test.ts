import { describe, expect, it } from "vitest";
import { isLeapJalaliYear, jalaliMonthLength, persianWeekday, toGregorian, toJalali } from "@/lib/jalali";

const intl = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
function viaIntl(d: Date) {
  const p = Object.fromEntries(intl.formatToParts(d).map((x) => [x.type, x.value]));
  return { jy: Number(String(p.year).replace(/\D.*$/, "")), jm: Number(p.month), jd: Number(p.day) };
}

describe("jalali calendar", () => {
  it("known dates", () => {
    expect(toJalali(2026, 11, 5)).toEqual({ jy: 1405, jm: 8, jd: 14 });
    expect(toJalali(2025, 3, 21)).toEqual({ jy: 1404, jm: 1, jd: 1 });
    expect(toGregorian(1405, 1, 1)).toEqual({ gy: 2026, gm: 3, gd: 21 });
    expect(toGregorian(1403, 12, 30)).toEqual({ gy: 2025, gm: 3, gd: 20 });
  });

  it("matches the browser's Persian calendar for every day 2015–2040 and round-trips", () => {
    for (let t = Date.UTC(2015, 0, 1); t <= Date.UTC(2040, 11, 31); t += 86_400_000) {
      const d = new Date(t);
      const j = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      expect(j).toEqual(viaIntl(d));
      expect(toGregorian(j.jy, j.jm, j.jd)).toEqual({ gy: d.getUTCFullYear(), gm: d.getUTCMonth() + 1, gd: d.getUTCDate() });
    }
  });

  it("month lengths, leap years and weekdays", () => {
    expect(isLeapJalaliYear(1403)).toBe(true);
    expect(isLeapJalaliYear(1404)).toBe(false);
    expect(jalaliMonthLength(1403, 12)).toBe(30);
    expect(jalaliMonthLength(1404, 12)).toBe(29);
    expect(jalaliMonthLength(1404, 7)).toBe(30);
    expect(persianWeekday(2026, 11, 7)).toBe(0); // Saturday
    expect(persianWeekday(2026, 11, 6)).toBe(6); // Friday
  });
});
