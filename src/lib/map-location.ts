import { toEnglishDigits } from "@/lib/format";

/**
 * Turns what the owner pastes in Admin → تماس (a Google Maps link, the «Embed a map» HTML, or
 * "lat, lng") into a safe embed URL and navigation links. Pure: used by the settings validator and
 * the contact page. Only Google Maps URLs are ever embedded (the CSP allows only that frame).
 */
export interface MapLocation {
  /** iframe src on www.google.com/maps, or null when the input gives no location to embed (short link). */
  embedUrl: string | null;
  coords: { lat: number; lng: number } | null;
  /** Opens the place in Google Maps (app on phones). */
  openUrl: string;
  /** Route from the visitor's position (Google Maps). */
  directionsUrl: string;
  /** Route in Waze, when coordinates are known. */
  wazeUrl: string | null;
}

const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/i;
const SHORT_HOST = /^(?:maps\.app\.goo\.gl|goo\.gl)$/i;

function validCoords(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

function fromCoords(lat: number, lng: number, embedUrl?: string): MapLocation {
  const ll = `${round(lat)},${round(lng)}`;
  return {
    embedUrl: embedUrl ?? `https://www.google.com/maps?q=${ll}&z=16&hl=fa&output=embed`,
    coords: { lat: round(lat), lng: round(lng) },
    openUrl: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
    wazeUrl: `https://waze.com/ul?ll=${ll}&navigate=yes`,
  };
}

/** Coordinates inside any Google Maps URL form (place data, @view, q/ll/query/destination params, embed pb). */
function coordsInUrl(u: URL): { lat: number; lng: number } | null {
  const text = decodeURIComponent(u.href);
  const pick = (lat: string, lng: string) => (validCoords(Number(lat), Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null);
  // Exact place pin: !3d<lat>!4d<lng> (links) or !2d<lng>!3d<lat> (embed "pb").
  let m = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m) return pick(m[1], m[2]);
  m = text.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  if (m) return pick(m[2], m[1]);
  for (const key of ["q", "query", "ll", "destination", "center"]) {
    const v = u.searchParams.get(key);
    const c = v?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (c) return pick(c[1], c[2]);
  }
  m = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return pick(m[1], m[2]);
  return null;
}

export function parseMapLocation(raw: string): MapLocation | null {
  let input = toEnglishDigits(raw ?? "").trim();
  if (!input) return null;

  // «Embed a map» HTML → its src attribute.
  const iframe = input.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i);
  if (iframe) input = iframe[1].replace(/&amp;/g, "&");

  // Plain coordinates: "35.7, 51.4"
  const plain = input.match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,،]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    return validCoords(lat, lng) ? fromCoords(lat, lng) : null;
  }

  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.protocol = "https:";

  if (SHORT_HOST.test(u.hostname)) {
    // Short share links can't be read without following Google's redirect: link out, no embedded map.
    const href = u.href;
    return { embedUrl: null, coords: null, openUrl: href, directionsUrl: href, wazeUrl: null };
  }
  if (!GOOGLE_HOST.test(u.hostname) || !(u.pathname.startsWith("/maps") || u.searchParams.has("q"))) return null;

  const coords = coordsInUrl(u);
  const isEmbed = u.pathname.startsWith("/maps/embed");
  const embedUrl = isEmbed ? `https://www.google.com${u.pathname}${u.search}` : undefined;
  if (coords) return fromCoords(coords.lat, coords.lng, embedUrl);

  // A place by name: /maps/place/<name>/ or ?q=<name>
  const name = u.searchParams.get("q") ?? u.searchParams.get("query") ?? decodeURIComponent(u.pathname.match(/\/maps\/place\/([^/]+)/)?.[1] ?? "").replace(/\+/g, " ");
  if (embedUrl) {
    return { embedUrl, coords: null, openUrl: u.href.replace("/maps/embed", "/maps"), directionsUrl: u.href.replace("/maps/embed", "/maps"), wazeUrl: null };
  }
  if (name.trim()) {
    const q = encodeURIComponent(name.trim());
    return {
      embedUrl: `https://www.google.com/maps?q=${q}&z=16&hl=fa&output=embed`,
      coords: null,
      openUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
      wazeUrl: null,
    };
  }
  return null;
}
