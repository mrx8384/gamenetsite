import { describe, expect, it } from "vitest";
import { nextDays, normalizeMobile, validateBooking } from "../../../src/atom-world/booking/booking";
import { EMPTY_CLUB, parseClub } from "../../../src/atom-world/data/remoteMachines";

const ok = { game: "air-hockey", day: "2026-10-24", time: "18:30", people: 3, name: "علی", phone: "09123456789", note: "" };

describe("booking request", () => {
  it("accepts Persian digits and +98 numbers", () => {
    expect(normalizeMobile("۰۹۱۲ ۳۴۵ ۶۷۸۹")).toBe("09123456789");
    expect(normalizeMobile("+98 912 345 6789")).toBe("09123456789");
    expect(normalizeMobile("00989123456789")).toBe("09123456789");
    expect(normalizeMobile("0212345678")).toBeNull();
    expect(normalizeMobile("0912")).toBeNull();
  });

  it("validates every field", () => {
    expect(validateBooking(ok)).toEqual({});
    const e = validateBooking({ ...ok, game: "", time: "25:00", people: 0, name: " ", phone: "123", note: "x".repeat(301) });
    expect(Object.keys(e).sort()).toEqual(["game", "name", "note", "people", "phone", "time"]);
  });

  it("offers the next 7 days with Persian (Jalali) labels", () => {
    const d = nextDays(7, new Date(2026, 9, 24));
    expect(d).toHaveLength(7);
    expect(d[0].iso).toBe("2026-10-24");
    expect(d[0].label.startsWith("امروز")).toBe(true);
    expect(d[1].label.startsWith("فردا")).toBe(true);
    expect(d[0].label).toContain("آبان");
  });
});

describe("club info from the site", () => {
  it("keeps only valid values; nothing is made up", () => {
    const c = parseClub({ version: 1, club: { phone: "۰۲۱-۱۲۳۴۵۶۷۸", whatsapp: "https://wa.me/989123456789", telegram: "javascript:alert(1)", hours: "شنبه تا پنجشنبه، ۱۰ تا ۲۲", mapUrl: "http://maps.example" } });
    expect(c.phone).toBe("021-12345678");
    expect(c.whatsapp).toBe("https://wa.me/989123456789");
    expect(c.telegram).toBe("");
    expect(c.mapUrl).toBe("");
    expect(c.hours).toBe("شنبه تا پنجشنبه، ۱۰ تا ۲۲");
    expect(parseClub({ version: 1 })).toEqual(EMPTY_CLUB);
    expect(parseClub(null)).toEqual(EMPTY_CLUB);
  });
});

import { boardTournaments, formatStart, parseEvents } from "../../../src/atom-world/data/events";

describe("tournaments & news from the site", () => {
  const base = { slug: "fc-cup", name: "جام FC", game: "EA FC 25", platform: "PS5", format: "SINGLE_ELIMINATION", status: "REGISTRATION", startsAt: "2026-11-01T15:00:00.000Z", participantCount: 6, maxParticipants: 16, organizerName: "اتم گیم کلاب", prize: "۲ میلیون تومان" };

  it("keeps valid tournaments with the site's fields", () => {
    const { tournaments } = parseEvents({ version: 1, tournaments: [base, { ...base, slug: "BAD SLUG" }, { ...base, status: "DRAFT" }, { ...base, slug: "x2", format: "POKER" }] });
    expect(tournaments.map((t) => t.slug)).toEqual(["fc-cup"]);
    expect(tournaments[0].prize).toBe("۲ میلیون تومان");
  });

  it("board order: open registration, then running, recent finished; no cancelled", () => {
    const now = Date.parse("2026-10-24T12:00:00Z");
    const list = parseEvents({
      version: 1,
      tournaments: [
        { ...base, slug: "done-old", status: "COMPLETED", startsAt: "2026-08-01T10:00:00Z" },
        { ...base, slug: "done-new", status: "COMPLETED", startsAt: "2026-10-20T10:00:00Z" },
        { ...base, slug: "live", status: "IN_PROGRESS" },
        { ...base, slug: "cancel", status: "CANCELLED" },
        { ...base, slug: "open", status: "REGISTRATION" },
      ],
    }).tournaments;
    expect(boardTournaments(list, now).map((t) => t.slug)).toEqual(["open", "live", "done-new"]);
  });

  it("start time in Tehran time with the Persian calendar; unknown start said plainly", () => {
    expect(formatStart("2026-11-01T15:00:00.000Z")).toContain("آبان");
    expect(formatStart("2026-11-01T15:00:00.000Z")).toContain("۱۸:۳۰");
    expect(formatStart(null)).toBe("زمان شروع هنوز اعلام نشده");
  });

  it("news needs a slug and a title", () => {
    const { news } = parseEvents({ version: 1, news: [{ slug: "opening", title: "افتتاح بخش RC" }, { slug: "x", title: "" }] });
    expect(news).toEqual([{ slug: "opening", title: "افتتاح بخش RC", excerpt: null, publishedAt: null }]);
  });
});
