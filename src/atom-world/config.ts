/**
 * Where «بازگشت به سایت» goes. Same origin by default (the game lives at /atom-world of the site).
 * Links between the site and the world are plain <a> (a full page load): the world's pages have their
 * own security policy (WebAssembly decoders) and the 3D page should not stay in memory.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_ATOM_SITE_URL || "/";

/**
 * JSON endpoint with the machine info edited in the site's admin panel (tariff, description,
 * photos). Unset = only the built-in data is used. After the merge: "/api/atom-world/machines".
 * Contract: docs/ADMIN_MACHINES.md.
 */
export const MACHINES_URL = process.env.NEXT_PUBLIC_ATOM_MACHINES_URL || "";

/**
 * The world layout / art / texts / machine info edited in this project's admin editor
 * (/atom-world/admin, docs/ADMIN_WORLD.md). "" = no server: in "local" admin mode (the stand-alone
 * preview) the editor saves on this device only and the game reads it from there.
 */
export const WORLD_URL = process.env.NEXT_PUBLIC_ATOM_WORLD_URL ?? "/api/atom-world/world";
export const ADMIN_MODE: "server" | "local" | "off" =
  process.env.NEXT_PUBLIC_ATOM_WORLD_ADMIN === "local" ? "local" : process.env.NEXT_PUBLIC_ATOM_WORLD_ADMIN === "off" ? "off" : "server";
/** Where the editor keeps its draft, and (local mode) the saved config. */
export const LOCAL_CONFIG_KEY = "atom-world:admin-local-config";

/**
 * Shared score table on the site (GET top scores, POST a new score). Unset = scores are kept on
 * this device only. After the merge: "/api/atom-world/scores". Contract: docs/SCORES.md.
 */
export const SCORES_URL = process.env.NEXT_PUBLIC_ATOM_SCORES_URL || "";

/**
 * Booking requests (POST, contract in docs/BOOKING.md). Unset = no request form; the booking panel
 * then only offers the club's phone / WhatsApp / contact page. After the merge: "/api/atom-world/booking".
 */
export const BOOKING_URL = process.env.NEXT_PUBLIC_ATOM_BOOKING_URL || "";

/**
 * Tournaments and news from the site (GET, contract in docs/EVENTS.md). Unset = the events board
 * only links to the site's tournaments page. After the merge: "/api/atom-world/events".
 */
export const EVENTS_URL = process.env.NEXT_PUBLIC_ATOM_EVENTS_URL || "";

/**
 * Test hooks (`?debug=1&machinesUrl=…`, `eventsUrl`, `bookingUrl`) may only point at `/mock-…` paths.
 * Any other address — even on the same site, e.g. an uploaded file under /media — is ignored, so a
 * crafted link can never show fake prices, phone numbers or events, or send a booking elsewhere.
 */
export function isTestPath(p: string) {
  return /^\/mock-[\w-]+\/[\w./-]+$/.test(p) && !p.includes("..");
}
