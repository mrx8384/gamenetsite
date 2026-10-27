# ATOM World (3D) on the site

The 3D world «دنیای سه‌بعدی اتم» was built in `mrx8384/gameatom` and merged here on 2026-10-26 (owner request:
«ادغام کن با سایت اصلی فقط یه دکمه بزار بنویس ورود به دنیای سه بعدی اتم گیم»). The only visible change to the
existing site is one button in the homepage hero: «ورود به دنیای سه‌بعدی اتم گیم» → `/atom-world`.

## What lives where

| Path | What |
|---|---|
| `src/atom-world/` | The whole module (game, mini-games, world editor, server helpers). CSS modules only, no Tailwind. |
| `src/atom-world/server/adminAuth.ts` | **The only file that differs from gameatom**: the world editor accepts the site's own ADMIN login (`getCurrentUser()` from `src/lib/auth/dal.ts`) or the editor password from `.env`. |
| `src/app/atom-world/page.tsx` | The game, full screen (outside `(public)`, so no site header/footer). |
| `src/app/atom-world/admin/page.tsx` | World editor (layout, wall art, texts, machine info, versions). Not linked anywhere; open it directly. |
| `src/app/api/atom-world/…` | `world` (public read), `admin/{session,world,versions,upload}` (ADMIN only), `media/[file]` (uploaded images), `rooms/…` (online play between two phones, in memory). |
| `public/atom-world/` | Models, textures, photos, icons, decoders, offline worker (`sw.js` + `offline-manifest.json`, generated). |
| `scripts/build-offline.mjs`, `scripts/sw-template.js` | Run by `pnpm build` before `next build` (regenerate the offline file list and worker). |
| `tests/unit/atom-world/` | The world's unit tests (+ `siteAdminAuth.test.ts` for the ADMIN check). |

Dependencies added (reason: 3D rendering): `three@0.186.1`, `@react-three/fiber@9.8.2`, dev `@types/three`.

## World editor

- Open `/atom-world/admin`. Two ways in (either is enough):
  - a site `ADMIN` account: «ورود با حساب مدیر سایت» → the site's `/login` → back to the editor;
  - the **editor password set on the VPS**: `sudo bash /srv/atom/app/scripts/set-world-password.sh` (asks twice,
    at least 10 characters, writes `ATOM_WORLD_ADMIN_PASSWORD` to `.env`, restarts `atom`; `--remove` turns it off).
    The installer never overwrites `.env`, so the password survives updates. Login = HttpOnly, SameSite=Strict
    cookie for 12 h, 5 tries a minute per address; changing the password signs everyone out
    (`src/atom-world/server/passwordLogin.ts`, shared with gameatom).
- Without a password or an ADMIN session nothing can be read or saved (`isAdmin` is checked on the server in every
  editor route; SUPPORT/PARTNER/USER are refused). Writes also require a same-origin request.
- Data: one folder **beside `UPLOAD_DIR`**, e.g. `/srv/atom/atom-world` (or `ATOM_WORLD_DATA_DIR` if set):
  `world-config.json`, the last 20 versions, uploaded images (stored by content hash, type sniffed; SVG/HTML refused).
  It is outside the app folder, so updates (`git reset --hard`) keep it; `scripts/backup.sh` backs it up as
  `atom-world-<stamp>.tar.gz`. `pnpm maintenance --media` does not touch it.

## Site settings changed for it

- `next.config.ts`
  - CSP for `/atom-world` and `/atom-world/*` only: `script-src … 'wasm-unsafe-eval'` (self-hosted Draco/Meshopt
    decoders compile WebAssembly — not JS eval) and `connect-src … blob:` (textures inside the character models).
    Every other page keeps the unchanged policy.
  - `/atom-world/sw.js` and `/atom-world/offline-manifest.json`: `Cache-Control: no-cache`;
    `/atom-world/sw.js`: `Service-Worker-Allowed: /atom-world` (the worker controls only the world's page).
  - Turbopack CSS rule: `*.module.css` is excluded from the Tailwind loader (with `as: "*.css"` it turned CSS
    modules into global CSS and every class name of the world became `undefined`).
- Links between the site and the world are plain `<a>` (full page load): the world's page has its own CSP, and the
  heavy WebGL page should not stay in memory. A client-side `<Link>` keeps the previous page's CSP and the
  decoders fail.
- `eslint.config.mjs`: `public/atom-world/**` ignored (minified third-party decoders, generated worker).
- `vitest.config.mts`: `server-only` aliased to a stub so the world's server modules can be unit-tested.

## Optional, off by default

The world works on its own built-in data. These site routes are not implemented yet; each is switched on by an
env variable at build time (contracts in gameatom `docs/`): `NEXT_PUBLIC_ATOM_MACHINES_URL` (machine info from the
admin panel), `NEXT_PUBLIC_ATOM_SCORES_URL` (shared score table), `NEXT_PUBLIC_ATOM_BOOKING_URL` (booking requests),
`NEXT_PUBLIC_ATOM_EVENTS_URL` (tournaments/news for the in-game board). Prices are never invented: without the
machines route the game says the tariff is not registered.

## Updating from gameatom

Copy again from gameatom: `src/atom-world/` (**except `server/adminAuth.ts`**), `src/app/atom-world/{page,admin/page}.tsx`,
`src/app/api/atom-world/`, `public/atom-world/`, `scripts/build-offline.mjs`, `scripts/sw-template.js`, and
`tests/unit/*.test.ts` → `tests/unit/atom-world/` (imports `../../src` → `../../../src`; leave out the password tests
in `adminServer.test.ts`). Then `pnpm check`, `pnpm build`.

## Verified (2026-10-26)

`pnpm check` (typecheck, lint, 354 unit tests) ✓ · `pnpm build` ✓ (all world routes dynamic) · smoke 84/84 ✓ ·
the world's own browser suites against this site: gaming center 39/39, mini-games 46/46, accessibility 30/30 ✓ ·
homepage button (desktop + mobile) → `/atom-world` with no console errors or CSP violations ✓ · editor: logged out →
site login → back in the editor → save → `/api/atom-world/world` serves it; save without login → 401 ✓.
Build cost measured on clean builds: peak memory about +6 %, build time about +11 s.
