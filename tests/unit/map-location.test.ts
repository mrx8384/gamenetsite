import { describe, expect, it } from "vitest";
import { parseMapLocation } from "@/lib/map-location";

describe("parseMapLocation", () => {
  it("reads plain coordinates, also with Persian digits", () => {
    const m = parseMapLocation("۳۵٫۷۰۰۱، ۵۱٫۴۰۰۲".replace(/٫/g, "."))!;
    expect(m.coords).toEqual({ lat: 35.7001, lng: 51.4002 });
    expect(m.embedUrl).toBe("https://www.google.com/maps?q=35.7001,51.4002&z=16&hl=fa&output=embed");
    expect(m.directionsUrl).toContain("destination=35.7001,51.4002");
    expect(m.wazeUrl).toContain("ll=35.7001,51.4002");
  });

  it("prefers the exact place pin over the map view in a shared link", () => {
    const m = parseMapLocation("https://www.google.com/maps/place/Atom+Game+Club/@35.70,51.39,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d35.7123!4d51.4045")!;
    expect(m.coords).toEqual({ lat: 35.7123, lng: 51.4045 });
  });

  it("uses the @view when no pin is given", () => {
    expect(parseMapLocation("https://www.google.com/maps/@35.71,51.41,15z")!.coords).toEqual({ lat: 35.71, lng: 51.41 });
  });

  it("keeps the official embed URL from the «Embed a map» HTML", () => {
    const html = '<iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3240!2d51.4045!3d35.7123!2m3!1f0" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>';
    const m = parseMapLocation(html)!;
    expect(m.embedUrl).toBe("https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3240!2d51.4045!3d35.7123!2m3!1f0");
    expect(m.coords).toEqual({ lat: 35.7123, lng: 51.4045 });
  });

  it("links out for short share links (no embedded map)", () => {
    const m = parseMapLocation("https://maps.app.goo.gl/AbCdEf123")!;
    expect(m.embedUrl).toBeNull();
    expect(m.openUrl).toBe("https://maps.app.goo.gl/AbCdEf123");
  });

  it("embeds a place given by name", () => {
    const m = parseMapLocation("https://www.google.com/maps/place/%D8%A7%D8%AA%D9%85+%DA%AF%DB%8C%D9%85+%DA%A9%D9%84%D8%A7%D8%A8/")!;
    expect(m.embedUrl).toContain("output=embed");
    expect(m.embedUrl).toContain(encodeURIComponent("اتم گیم کلاب"));
  });

  it("rejects anything that is not Google Maps or a valid location", () => {
    expect(parseMapLocation("")).toBeNull();
    expect(parseMapLocation("https://evil.example/maps/embed?pb=1")).toBeNull();
    expect(parseMapLocation('<iframe src="https://evil.example/x"></iframe>')).toBeNull();
    expect(parseMapLocation("javascript:alert(1)")).toBeNull();
    expect(parseMapLocation("95, 51")).toBeNull();
    expect(parseMapLocation("https://www.google.com/search?q=x")?.embedUrl ?? null).not.toContain("evil");
  });

  it("never embeds a non-Google host even via the embed path", () => {
    expect(parseMapLocation("https://www.google.com.evil.io/maps/embed?pb=x")).toBeNull();
    expect(parseMapLocation("https://google.ev.io/maps/@35.7,51.4,15z")).toBeNull();
    expect(parseMapLocation("https://www.google.co.uk/maps/@35.7,51.4,15z")!.embedUrl).toMatch(/^https:\/\/www\.google\.com\/maps\?/);
  });
});
