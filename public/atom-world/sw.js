/* ATOM World service worker — generated from scripts/sw-template.js by scripts/build-offline.mjs.
 * Scope: /atom-world (needs the header Service-Worker-Allowed: /atom-world); the rest of the site is never touched.
 * - pages under /atom-world: network first (3.5 s), then the saved copy → opens without internet
 * - /_next/static/* (hashed, never change) and /atom-world/* files: cache first, saved on first use
 * - "cache-all" message: saves every file of the 3D world (button «ذخیره برای اجرا بدون اینترنت»)
 * - other requests (APIs, other pages): not intercepted
 */
const VERSION = "0f7c9d02672c";
const ASSETS = [{"url":"/atom-world/envs/gaming-center/controllers-wall.webp","bytes":19530},{"url":"/atom-world/envs/gaming-center/counter-shelves.webp","bytes":35526},{"url":"/atom-world/envs/gaming-center/mural-castle.webp","bytes":65468},{"url":"/atom-world/envs/gaming-center/mural-paris.webp","bytes":20858},{"url":"/atom-world/envs/gaming-center/mural-train.webp","bytes":27730},{"url":"/atom-world/envs/gaming-center/painting-paris.webp","bytes":7816},{"url":"/atom-world/envs/gaming-center/photos/02-room-train-mural-tv.webp","bytes":20220},{"url":"/atom-world/envs/gaming-center/photos/03-counter-shop-purple-shelves.webp","bytes":38880},{"url":"/atom-world/envs/gaming-center/photos/05-arch-chalkboard-stations-2-3.webp","bytes":52878},{"url":"/atom-world/envs/gaming-center/photos/10-long-view-paris-cafe-london.webp","bytes":26316},{"url":"/atom-world/envs/gaming-center/photos/15-street-facade-sign.webp","bytes":48650},{"url":"/atom-world/envs/gaming-center/poster-deer.webp","bytes":6332},{"url":"/atom-world/envs/gaming-center/stone-wall.webp","bytes":37188},{"url":"/atom-world/envs/gaming-center/street-door-view.webp","bytes":13036},{"url":"/atom-world/envs/gaming-center/wall-portraits.webp","bytes":35626},{"url":"/atom-world/icons/apple-touch-icon.png","bytes":11061},{"url":"/atom-world/icons/icon-192.png","bytes":8850},{"url":"/atom-world/icons/icon-512.png","bytes":35059},{"url":"/atom-world/icons/maskable-192.png","bytes":9629},{"url":"/atom-world/icons/maskable-512.png","bytes":51087},{"url":"/atom-world/manifest.webmanifest","bytes":994},{"url":"/atom-world/models/atom-boy.glb","bytes":131896},{"url":"/atom-world/models/atom-girl.glb","bytes":138468},{"url":"/atom-world/photos/air-hockey-left-wall.webp","bytes":44490},{"url":"/atom-world/photos/construction-zone.webp","bytes":39230},{"url":"/atom-world/photos/entrance-glass-white-sofas.webp","bytes":41494},{"url":"/atom-world/photos/exterior-facade-night.webp","bytes":62570},{"url":"/atom-world/photos/foot-pool-field-and-mural.webp","bytes":52282},{"url":"/atom-world/photos/footballs-tables-gray-sofa.webp","bytes":87546},{"url":"/atom-world/photos/hall-overview.webp","bytes":72298},{"url":"/atom-world/photos/staircase.webp","bytes":67538},{"url":"/atom-world/references/characters/boy/boy-thumb.webp","bytes":3504},{"url":"/atom-world/references/characters/girl/girl-thumb.webp","bytes":3408},{"url":"/atom-world/textures/air-hockey-side-panel.webp","bytes":26196},{"url":"/atom-world/textures/atom-logo.webp","bytes":15008},{"url":"/atom-world/textures/mural-batman-joker.webp","bytes":35930},{"url":"/atom-world/textures/mural-excavator.webp","bytes":40372},{"url":"/atom-world/textures/mural-lamppost-man.webp","bytes":46494},{"url":"/atom-world/textures/mural-upper-back.webp","bytes":77782},{"url":"/atom-world/textures/mural-upper-cards.webp","bytes":32366},{"url":"/atom-world/textures/mural-upper-dice.webp","bytes":76074},{"url":"/atom-world/textures/mural-woman-lamp.webp","bytes":32434},{"url":"/atom-world/textures/sm/air-hockey-side-panel.webp","bytes":8206},{"url":"/atom-world/textures/sm/mural-batman-joker.webp","bytes":9906},{"url":"/atom-world/textures/sm/mural-excavator.webp","bytes":13948},{"url":"/atom-world/textures/sm/mural-lamppost-man.webp","bytes":11782},{"url":"/atom-world/textures/sm/mural-upper-back.webp","bytes":25402},{"url":"/atom-world/textures/sm/mural-upper-cards.webp","bytes":10968},{"url":"/atom-world/textures/sm/mural-upper-dice.webp","bytes":24638},{"url":"/atom-world/textures/sm/mural-woman-lamp.webp","bytes":8770}];
const PAGE = "/atom-world";
const CACHE = `atom-world-${VERSION}`;

self.addEventListener("install", (event) => {
  // small core so a reload works offline right away; the rest on demand
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([PAGE, "/atom-world/manifest.webmanifest", "/atom-world/icons/icon-192.png"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("atom-world-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isWorldPage(url) {
  return url.pathname === PAGE || url.pathname === `${PAGE}/`;
}

// files only (with an extension): pages under /atom-world (e.g. the /atom-world/admin editor) are never cached
function isStatic(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  // images uploaded in the world editor: named by content hash, never change
  if (/^\/api\/atom-world\/media\/[a-f0-9]{64}\.(png|jpg|webp)$/.test(url.pathname)) return true;
  return /^\/atom-world\/.+\.[a-z0-9]+$/i.test(url.pathname) && !url.pathname.endsWith("/sw.js");
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3500));
  try {
    const fresh = fetch(request).then((res) => {
      if (res.ok) cache.put(PAGE, res.clone());
      return res;
    });
    const res = await Promise.race([fresh, timeout]);
    if (res) return res;
    const saved = await cache.match(PAGE);
    return saved || (await fresh);
  } catch {
    const saved = await cache.match(PAGE);
    if (saved) return saved;
    throw new Error("offline and not saved");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: request.url.includes("/atom-world/") });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate" && isWorldPage(url)) event.respondWith(networkFirst(req));
  else if (req.mode !== "navigate" && isStatic(url) && !url.search.includes("_rsc")) event.respondWith(cacheFirst(req));
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  const reply = (data) => event.source && event.source.postMessage(data);
  if (msg.type === "status") {
    caches
      .open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.match(a.url))))
      .then((hits) => reply({ type: "status", version: VERSION, saved: hits.filter(Boolean).length, total: ASSETS.length }));
  }
  if (msg.type === "cache-all") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        let done = 0;
        let failed = 0;
        const total = ASSETS.length + 1 + (Array.isArray(msg.extra) ? msg.extra.length : 0);
        const one = async (url) => {
          try {
            if (!(await cache.match(url))) {
              const res = await fetch(url, { cache: "reload" });
              if (!res.ok) throw new Error(String(res.status));
              await cache.put(url, res);
            }
          } catch {
            failed++;
          }
          done++;
          reply({ type: "progress", done, total, failed });
        };
        await one(PAGE);
        // files of this page that loaded before the worker took over (code chunks, font)
        const extra = (Array.isArray(msg.extra) ? msg.extra : []).filter((u) => typeof u === "string" && u.startsWith("/_next/static/"));
        // a few at a time: friendly to slow connections
        const queue = [...ASSETS.map((a) => a.url), ...extra];
        await Promise.all(Array.from({ length: 4 }, async () => {
          while (queue.length) await one(queue.shift());
        }));
        reply({ type: "cached", version: VERSION, failed });
      })(),
    );
  }
});
