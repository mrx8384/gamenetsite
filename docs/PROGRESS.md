# Progress Log

## 2026-10-31 (42) — Hide/show site sections (owner request)

- Admin → تنظیمات سایت → «نمایش بخش‌ها» (`/admin/settings/sections`, ADMIN only): switches for shop, game catalog,
  tournaments, amusement park, news, partners, about and the 3D world (contact always on). Stored in
  `site_settings` key `sections` (`src/features/settings/sections*.ts`, cached under the `settings` tag; default all on).
- A hidden section: removed from header, hamburger menu, footer (`visibleLinks`), homepage blocks and hero buttons,
  park-page 3D buttons and the sitemap; its pages show the 404 page to visitors (`SectionGate` in section layouts, and
  per page for tournaments so `/tournaments/gamepad-tester` stays open for partners); admins still see the pages with a
  «مخفی است» notice. Hiding the shop also hides the cart button and closes sales (`isSalesOpen`), so cart/checkout
  actions refuse too. The partner panel `/partner` stays available. Nothing is deleted.
- Verified: `pnpm check` ✓ (417, new `tests/unit/sections.test.ts`) · `pnpm build` ✓ · smoke 89/89 · browser test with a
  `[TEST]` admin: hiding shop + news + partners removed them from desktop/mobile/footer menus, homepage blocks, hero
  button and sitemap; `/shop`, `/news`, `/partners`, `/cart` → 404 for visitors while `/contact` and the gamepad tester
  stayed; admin saw `/news` with the notice; switching back restored everything. Test settings and admin removed.

## 2026-10-31 (41) — «شهربازی اتم گیم» page (owner request)

- New public page `/amusement-park` (menu item «شهربازی اتم گیم» in header, hamburger menu and footer; in the sitemap;
  `pageMetadata` with canonical). Design: hero with title/subtitle/intro, 3D-world and directions buttons and a photo
  collage; chips linking to each section; alternating photo/text rows numbered ۰۱…; address/hours/phone strip from the
  contact settings; dark call-to-action band to the 3D world. Sections without a photo get a branded placeholder.
- Content: model `ParkAttraction` (migration `park_attractions`) seeded with 7 sections whose texts and photos come from
  the 3D world (`src/atom-world/data/machineData.ts`, `public/atom-world/...`): گیم‌نت (PS5/PS4), ایرهاکی, فوت‌پول,
  FOOTBALLS, RC کلاب, گریم صورت, پیشخوان و فروشگاه. Internal notes («محل … تأیید نشده», «توضیح … پس از تأیید») left out.
- Admin → تنظیمات سایت → «شهربازی اتم گیم» (`/admin/settings/park`, ADMIN only): page texts (settings group `park`) +
  sections list (add/edit/reorder/hide/delete, photo upload to folder `park`; an upload replaces the built-in photo,
  «حذف عکس» removes both). Built-in photo paths are accepted only under `/atom-world/` (`staticImageUrl`). Uploaded
  images are protected in `deleteUnusedMedia` and `pnpm maintenance --media`. Cache tag `park`.
- Verified: `pnpm check` ✓ (413, new `tests/unit/park.test.ts`) · `pnpm build` ✓ · smoke 89/89 (page added) · browser:
  390/1024/1366 px — 7 sections, no broken images, page width = screen, desktop menu stays one line, item in the
  hamburger menu; admin edit of the title + new photo/description for «گریم صورت کودکان» showed on the page. Test edits,
  upload and admin removed.

## 2026-10-31 (40) — Featured products order + shop location map (owner request)

- **Featured order:** new `Product.featuredSort` (migration `featured_sort`, backfilled with today's order: newest edit
  first). Homepage shows the first `FEATURED_ON_HOME` (4) active featured products by that order instead of by last
  edit. Admin → تنظیمات سایت → فروش: «ترتیب محصولات منتخب صفحهٔ اصلی» list with up/down, edit link, «برداشتن از
  منتخب», badges for shown / not shown / inactive (`moveFeaturedProduct`, `unfeatureProduct`). A product that becomes
  featured goes to the end.
- **Contact map:** new contact setting `mapLocation` (field type `map`) accepting Google Maps «Embed a map» HTML, a full
  Google Maps link, or coordinates; validated and converted by the pure `src/lib/map-location.ts` (only Google hosts;
  embed src always rebuilt on `www.google.com`; short `maps.app.goo.gl` links → buttons only). `/contact` shows
  «موقعیت ما روی نقشه» (`src/components/contact/location-map.tsx`): address, «مسیریابی با گوگل‌مپ», Waze, optional
  Neshan/Balad button from `mapUrl`, lazy iframe with a branded placeholder. CSP: `frame-src https://www.google.com` on
  `/contact` only (everything else stays `'none'`). Homepage business JSON-LD gets `geo` coordinates and `hasMap`.
- Verified: `pnpm check` ✓ (411, new `tests/unit/map-location.test.ts`) · `pnpm build` ✓ · smoke 84/84 · browser test
  with `[TEST]` admin/products: moving product 5 up twice changed the homepage from 1,2,3,4 to 1,2,5,3 with correct
  badges; invalid map input rejected with the message; embed code → iframe on www.google.com, buttons, page width =
  screen at 390/1366 px; `/shop` keeps `frame-src 'none'`. (Google itself is blocked in the dev sandbox, so only the
  placeholder was visible.) Test data removed.

## 2026-10-31 (39) — «سازمان‌های طرف قرارداد» on the homepage (owner request)

- New model `ContractOrganization` (migration `contract_organizations`): name, logo (Media, folder `organizations`,
  max 600 px), optional description, contract terms and website, `showDetails`, `isActive`, `sortOrder`.
- Admin → تنظیمات سایت → «سازمان‌های طرف قرارداد» (`/admin/settings/organizations`, ADMIN only): section title and
  subtitle (new settings group `organizations`) + list with add/edit (logo upload), reorder, hide, delete
  (`src/features/organizations/`; deleting/replacing a logo removes the unused file; logos counted as used by
  `deleteUnusedMedia` and `pnpm maintenance --media`).
- Homepage, under «درباره اتم» (`OrganizationsSection` + client `OrganizationsStrip`): one horizontal row; when the
  logos don't fit, the list is rendered twice and drifts slowly (28 px/s, seamless wrap, faded edges); touch swipe,
  mouse drag and wheel move it and pause the drift for 2.5 s (hover pauses too); reduced-motion → no drift; fits →
  centred. Organizations with details open a dialog (logo, name, description, terms, website). No organizations →
  the section is not rendered. Cached with tag `organizations`.
- Verified: `pnpm check` ✓ (403, new `tests/unit/organizations.test.ts`) · `pnpm build` ✓ · smoke 84/84 with test
  organizations on the homepage (incl. axe) · browser test with a temporary `[TEST]` admin: validation message, logo
  upload, create with terms; homepage at 390 px and 1366 px: drift ≈ 28 px/s, page width = screen width, swipe holds
  the row then drift resumes, dialog content correct. Test organizations, logo file and admin removed.

## 2026-10-31 (38) — Email codes instead of SMS (owner request: «بجای sms.ir از ایمیل استفاده کنیم»)

- SMTP sending implemented (`src/lib/notify/mail.ts`, dependency `nodemailer` 10.3.1 — the planned mailer, see
  ARCHITECTURE §6): settings as `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD` (easier for the owner, no URL
  encoding) or one `SMTP_URL`; 465 = TLS, 587 = STARTTLS required; bounded timeouts; plain text + right-to-left HTML;
  errors carry the SMTP step/code but never the password. Env check refuses `MAIL_PROVIDER=smtp` without credentials.
- While SMS is not live in production (`smsCodesAvailable()` in `src/features/auth/verification.ts`), registration,
  login-by-code, password reset and profile mobile change refuse mobile numbers with a clear message pointing to email;
  password login keeps working. Development still logs SMS codes.
- Admin → تنظیمات سایت → «پیامک و ایمیل»: email status (host, password set or not, whether mobile codes work) and a
  test-email form (`src/features/mail/test-actions.ts`, ADMIN only, 5 per 10 min, audit `mail.test_sent/failed`).
- Verified: `pnpm check` ✓ (400, new `tests/unit/mail.test.ts`) · `pnpm build` ✓ · smoke 84/84 · production server
  against a local SMTP test server requiring login (password with `@ : /`): mobile sign-up refused with the message,
  email sign-up got the code (sender, subject, RTL HTML checked), entering it created the account; wrong password →
  error within 20 s without the password in it. Test users/codes removed.
- Owner: create a mailbox (e.g. `info@atomgclub.ir`) on the cPanel host, add its MX/SPF/DKIM records in ArvanCloud, put
  the SMTP values in the server `.env`, restart, send a test email.

## 2026-10-30 (37) — Tournaments: bulk add participants (owner request)

- «افزودن دسته‌جمعی» under the single-add form (admin and partner tournament pages): paste names, one per line (also
  «،» / «;»); list markers like «۱.» «2)» «-» «•» are stripped, names starting with digits («50 Cent») kept. Live count,
  repeats and free capacity shown before sending.
- `addParticipantsBulk` (`src/features/tournaments/actions.ts`): same permission/lock rules as single add, one transaction
  with the tournament row lock (`FOR UPDATE`) so capacity and seeds stay correct; appended in list order. Duplicates
  (vs. existing participants or within the list) compared by `participantKey()` — spacing, case and Arabic/Persian letter
  variants ignored. Reports added / duplicate / invalid / over-capacity names; invalid and over-capacity names stay in the
  box for fixing. Audit `tournaments.participants_bulk_added`. Pure parser in `src/features/tournaments/bulk.ts`.
- Verified: `pnpm check` ✓ (396, new `tests/unit/tournament-bulk.test.ts`) · `pnpm build` ✓ · smoke 84/84 · browser test
  at phone width with a temporary `[TEST]` admin and tournament (capacity 8, 1 existing, 12 pasted lines → 7 added, 2
  duplicates, 1 invalid, 2 over capacity; page 390 px wide); test admin, tournament and audit rows removed.

## 2026-10-29 (38) — 3D world: machines room behind the hall, gaming-center stairs by station 5 (owner requests)

- «این در هم وردار که به صورت مستقیم بشه رفت داخل بخش ماشین آلات»: the construction-machines room now stands right
  behind the hall's back wall; the door is an open doorway (no travel). Hall and room are drawn together
  (`EnvironmentDef.neighbours`), walkable areas let the doorway through.
- Gaming center (owner's map): the stair corridor moved from north of the counter to the bottom right — the stair door
  is in the east wall next to station 5 and the corridor runs east to the street door. Same stairs, turned into place
  (`STAIR_FRAME` in `gaming-center/layout.ts`); map, spawns, street-door portal and colliders follow.
- Verified: `pnpm check` ✓ (392) · `pnpm build` ✓ · world suites on this site: gaming center 41/41, bounds 9/9,
  mini-games 55/55, accessibility 30/30 · smoke 84/84 · editor suite (gameatom) 27/27.

## 2026-10-29 (37) — 3D world: face-painting table under the stairs (owner request)

- Owner (two phone screenshots): «این میز گریم ببر زیر پله ها جای اون میز». The face-painting table now stands under
  the stairs in place of the small wooden desk (desk and its collider removed); the two grey poufs moved onto the
  kids' carpet in front of it. A layout saved in the editor keeps the new spot unless the table was moved there.
- Verified: `pnpm check` ✓ (392) · `pnpm build` ✓ · smoke 84/84 · world suites on this site: mini-games 55/55,
  bounds 9/9, accessibility 30/30.

## 2026-10-29 (36) — Shop page wider than the phone screen (owner screenshot)

- On phones `/shop` was 2697 px wide (screen 390 px), so the browser zoomed out/in. Cause: the mobile category row
  (`overflow-x-auto`) sits in a grid with no explicit column; an implicit `auto` column grows to the row's full
  min-content width. Fix: `grid-cols-1` (= `minmax(0,1fr)`) + `min-w-0` on the aside. Same pattern fixed on the product
  page (gallery thumbnails), account layout (account menu) and tournament page.
- Rule for new layouts: a grid holding a horizontal scroller needs `grid-cols-1` on mobile and `minmax(0,1fr)` instead of
  `1fr` in arbitrary column templates.
- Verified: reproduced with 10 temporary `[TEST]` categories (2697 → 390 px at 390 px width, screenshot checked; removed
  afterwards) · `pnpm check` ✓ (392) · `pnpm build` ✓ · smoke 84/84. The smoke test's mobile-overflow check exists but
  only catches this when the database has categories.

## 2026-10-28 (36) — 3D world: «گریم صورت» face-painting mini-game (owner request)

- Owner (screenshot of the kids' carpet): «بیا اینجا یک مینی گیم گریم صورت هم اضافه کن». Synced from gameatom (phase 21):
  a vanity with a lit mirror on the kids' carpet (movable item `face-paint` in the editor) opens the new mini-game.
  Three children ask for a design on a card; the player paints it with 9 colours / 3 brushes / eraser; likeness
  0–100 % on a grid of the face, points = likeness × 10 + time bonus. Four achievements (one hidden).
- Site: `GAME_NAMES` row «🎨 گریم صورت»; `face-paint` is a playable game for points (from the shared list), so
  «جهانگرد اتم» now also needs it (test updated). No schema change.
- Verified: `pnpm check` ✓ (392) · `pnpm build` ✓ · smoke 84/84 · world suites on this site: mini-games 55/55 (incl.
  face painting), gaming center 41/41, bounds 9/9, online 27/27, accessibility 30/30 (its camera-turn check now waits
  for the turn: the test browser's software WebGL draws only a few frames a second right after loading).

## 2026-10-28 (35) — Technical SEO (owner request: «سئو سایت خودت انجام میدی»)

- `src/lib/seo.ts`: `pageMetadata()` (title, description, **canonical**, complete Open Graph + Twitter block — a page's
  `openGraph` replaces the layout's whole block), `seoPath()` (encoded Persian slugs), `metaDescription()`,
  `breadcrumbJsonLd()`, `jsonLdHtml()`. Used by every public page (home, shop, product, news, article, catalog,
  tournaments, tournament, gamepad tester, partners, about, contact) + canonical on `/atom-world`.
- Titles: template `%s | اتم گیم کلاب` (Persian brand, as people search); homepage title editable in
  Admin → تنظیمات سایت → عمومی و فوتر («عنوان صفحهٔ اصلی در گوگل», new `general.homeTitle`); better default
  site description; keyword-bearing titles/descriptions on section pages.
- Structured data: homepage Organization gets description, phone, email, map, social `sameAs` from contact settings and
  becomes `EntertainmentBusiness` (LocalBusiness) once an address is set; BreadcrumbList on product and news pages;
  NewsArticle gets `author`; news pages emit `article:published_time`/`modified_time`.
- Sitemap: + public tournaments (`/tournaments/[slug]`) and `/atom-world`. robots.txt: **bug fixed** — `Disallow: /partner`
  also blocked the public `/partners` page (prefix match); now `/partner/` + `/partner$`; + `/atom-world/admin`,
  internal shop search (`/shop?*q=`).
- Verified: `pnpm check` ✓ (386, new `tests/unit/seo.test.ts` incl. a robots matcher) · `pnpm build` ✓ · smoke 84/84 ·
  production server: titles/canonical/og tags on pages, JSON-LD, sitemap, robots; a temporary `[TEST]` news post showed
  canonical, article tags, breadcrumbs and sitemap entry (removed afterwards).
- Owner-side (not code): Google Search Console + sitemap submission, filling contact/address/socials, real content
  (products, news), Google Business Profile / Neshan / Balad listings, backlinks.

## 2026-10-28 (34) — 3D world: owner's bug report (connection, foot-pool, side view, machines door)

- **Online rooms, editor saves, editor password login and game points were refused on the live site** (403 →
  «اتصال برقرار نشد» / «ذخیره انجام نشد»). Cause: behind ArvanCloud → nginx the app sees `http://127.0.0.1` with
  `X-Forwarded-Proto: http`, so `sameOrigin()` (`src/atom-world/server/http.ts`, also used by `/api/game-rewards/*`)
  rejected the browser's `https://www.atomgclub.ir` Origin. Now host names only, against Host / X-Forwarded-Host, the
  request URL and `APP_URL`; other sites still get 403. Reproduced locally with the live headers, then fixed.
- **Foot-pool throws you out of the building**: a jump on the upper-floor field put the head into the ceiling slab
  and the collision step pushed the player out through the nearest face (old code: z −33). Ceilings no longer push
  sideways; jumps stop at the ceiling. A walkable-area guard brings anyone outside back (no more side view into the
  hall). The wooden door at the back of the ground floor now leads to the machines room and back.
- Verified: `pnpm check` ✓ (379) · `pnpm build` ✓ · smoke 84/84 · world suites on this site: bounds 9/9 (new),
  gaming center 41/41, mini-games 49/49, online 27/27, accessibility 30/30 · editor suite (gameatom) 27/27 ·
  CDN-style requests: own Origin 200, other site 403, editor save without login 401.

## 2026-10-27 (33) — Admin SMS status + test tool

- Admin → تنظیمات سایت → «پیامک» (`/admin/settings/sms`, ADMIN only): shows SMS_PROVIDER, whether a key is set (never the key), template IDs; sends one test SMS (OTP template with code 12345, or either support template) and shows SMS.ir's exact answer; rate limited 5/10 min; audit entries `sms.test_sent` / `sms.test_failed`.
- `sendTemplateSms` network errors now include the cause code (ENOTFOUND, ECONNREFUSED, …).
- Verified (production build): log mode → explanatory message; smsir with a fake key → error with cause shown; invalid mobile rejected; key not in page HTML or server log; normal user 404; typecheck/lint/214 tests ✓. A real send could not be tested (SMS.ir unreachable from the dev environment).

## 2026-10-27 (32) — 3D world: online room button always visible (owner request)

- Owner: «ساخت روم برای بازی انلاین چرا حذف شده بزار باشه». The «🌐 آنلاین با دوست» button was hidden whenever the
  room check (`GET /api/atom-world/rooms`) did not answer within 5 s (stand-alone preview, slow connection). It is now
  always shown in two-player games; without a server it says why and offers «دوباره امتحان»; the check waits 10 s.
- Verified: `pnpm check` ✓ (373) · `pnpm build` ✓ · smoke 84/84 · online suite on this site 27/27 (create room, join by
  code, play) · blocked room server → explanation, retry → lobby.

## 2026-10-27 (31) — 3D world: the rival walks in, NPCs with different builds (owner request)

- Owner: «وقتی مینی گیم ها رو با کامپیوتر بازی میکنی یکی از npc ها بیاد باهات بازی … اگه پسر اتم بود اون دختر … این npc ها
  رو مدل مختلف باشه یکی چاق یکی لاغر داخل سطح شهر باشه». Synced from gameatom (phase 19; only `src/atom-world/` changed).
- Before the first round against the computer (ایرهاکی, فوتبال اتم) the other ATOM character walks in, turns to the
  player and gestures: «👋 دختر اتم / پسر اتم آمد با شما بازی کند!» (~3 s, «رد کردن» skips, short still with reduced
  motion; not in two-player / online mode). Visitors now have body builds (heavy, slim, tall, short); four passers-by
  walk on the sidewalk outside the club.
- Verified: `pnpm check` ✓ (373 tests incl. `atom-world/bodyBuilds.test.ts`) · `pnpm build` ✓ · smoke 84/84 · world suites on
  this site: mini-games 49/49 (rival = girl when playing as the boy), gaming center ✓ (rival = boy when playing as the
  girl, heavy + slim passers-by on the sidewalk), accessibility 30/30.

## 2026-10-27 (30) — 3D world editor password set on the VPS (owner request)

- `/atom-world/admin` now also accepts a password from `.env` (`ATOM_WORLD_ADMIN_PASSWORD`), besides site ADMIN accounts.
  Set / change / remove it on the server with `sudo bash scripts/set-world-password.sh` (hidden input twice, ≥ 10
  characters, `.env` stays 600, restarts `atom`). Shared code: `src/atom-world/server/passwordLogin.ts` (HMAC cookie 12 h,
  SameSite=Strict, constant-time check, 5 tries / minute); the editor shows the password form plus «یا ورود با حساب مدیر سایت».
- Verified: `pnpm check` ✓ (369 tests; `siteAdminAuth.test.ts` covers no password → site login only, wrong / right
  password, cookie invalid after a password change, logout) · `pnpm build` ✓ · browser: password form, wrong password
  refused, VPS password opens the editor, save works, «خروج» ends it · script tested on a throwaway `.env` (save,
  too short refused, remove, permissions 600).

## 2026-10-27 (29) — 3D world achievements, points and discount cards (owner request)

### Scope
- Owner: several achievements per game with one hidden, points that buy discount cards (e.g. 1000 → 10 %), all editable
  by the manager. Answers: points from achievements + every round; site accounts only; the manager picks in-store /
  online per card. Details: `docs/GAME_REWARDS.md`.
- New: models `GamePointsEntry`, `GameAchievementUnlock`, `RewardCard`, `RewardRedemption` (migration `game_rewards`,
  tables only, no change to existing columns); `src/features/game-rewards/` (pure rules, service, admin and checkout
  actions); `/api/game-rewards` (status, round, redeem); admin `/admin/game-rewards` (rules + achievement points, cards,
  code check + manual points); checkout field «کد کارت تخفیف اتم»; cancelled orders give the card back.
- World (gameatom): 26 achievements (≥ 3 per game + 1 hidden each, 2 for the whole world), points per achievement,
  «⭐ امتیاز و جایزه» tab, points on the result card, «دستاورد مخفی» display.
- Risks handled: fake rounds (server re-checks achievement stats, daily cap, gap, rate limits, login, same-origin);
  double spending (user row lock; parallel test); 100 % online discounts (max 90 %); cards of other users at checkout.

### Verification
- `pnpm check` ✓ (369 tests incl. `game-rewards.test.ts`) · `pnpm build` ✓ · smoke 84/84 · world suites on the site:
  gaming center 39/39, mini-games 46/46, accessibility 30/30 (one camera-timing check failed once on the first visit
  after a build, passed on the re-run).
- Local DB checks of every transaction (see the doc) ✓; browser flow admin → world → counter (17 checks) ✓; checkout with
  the sandbox gateway in dev: −10 % in the summary, failed payment → card back, paid → card used, order totals correct ✓.

### Next (owner)
- Run the update on the server (it applies the migration). Then Admin → دستاوردها و جوایز: check the rules and create
  the first card (nothing is offered until a card exists).

## 2026-10-26 (28) — Brand spelling «اتم» everywhere (owner request: «همه اون آتم ها رو به اتم تبدیل کن»)

- Code: every «آتم» → «اتم» (49 places in 29 files: page titles and meta descriptions, JSON-LD names, brand
  constants, admin panel header, email subjects and bodies, payment description, empty states, form hints, the
  502/503/504 page in `deploy/errors/`, the 3D world's default organizer name, tests, DEPLOYMENT/ROADMAP examples).
  Older entries of this log are left as written (history).
- Data: migration `20261026090000_brand_spelling_atom` (data only, idempotent) updates texts already saved from the
  admin panel: `site_settings` values and the `pages` table (title, HTML, JSON). News, products, FAQs and other content
  written in the admin panel are not touched.
- Not in this repo: SMS.ir templates hold their own text; templates created with «آتم» must be edited in the SMS.ir panel.
- Verified: migration on a local DB (old texts in settings + About page → «اتم», other values unchanged, second run
  no-op) · `pnpm check` ✓ (354 tests) · `pnpm build` ✓ · smoke 84/84 · no «آتم» in the HTML of /, /about, /shop,
  /news, /contact, /partners, /tournaments, /tournaments/gamepad-tester, /game-catalog, /game-catalog/ps4, /login,
  /atom-world.

## 2026-10-26 (27) — 3D world merged (owner request: one button «ورود به دنیای سه‌بعدی اتم گیم»)

### Scope
- The 3D world from `mrx8384/gameatom` is now part of the site at `/atom-world` (game) and `/atom-world/admin`
  (world editor). Visible change to the existing site: **one** outline button in the homepage hero. Details: `docs/ATOM_WORLD.md`.
- New dependencies (reason: 3D rendering): `three@0.186.1`, `@react-three/fiber@9.8.2`, dev `@types/three`.
- Risks handled: CSP relaxed **only on the world's pages** (`'wasm-unsafe-eval'`, `blob:` in connect-src); the
  Tailwind CSS rule no longer swallows CSS modules; plain links between site and world (a client-side navigation
  kept the homepage CSP and blocked the decoders); editor data beside `UPLOAD_DIR` (kept by updates, in backups).

### Done
- World editor login = the site's ADMIN accounts (`src/atom-world/server/adminAuth.ts`, the only file that differs
  from gameatom); not logged in → link to `/login?next=/atom-world/admin`.
- `pnpm build` regenerates the world's offline files first (`scripts/build-offline.mjs`); headers for its worker.
- `scripts/backup.sh` also archives the world editor folder (`atom-world-<stamp>.tar.gz`, same retention).

### Verification
- `pnpm check` ✓ (354 tests incl. the world's and `siteAdminAuth.test.ts`) · `pnpm build` ✓ · smoke 84/84 ✓.
- Against a local production build: world suites gaming center 39/39, mini-games 46/46, accessibility 30/30;
  homepage button desktop + mobile → world, no console errors / CSP violations; editor flow (logged out → site login →
  editor → save → public config updated; save without login → 401).
- Clean-build cost: peak memory about +6 %, time about +11 s (the installer's build limit stays 1536 MB).

### Next (owner)
- Run the update on the server (installer or DEPLOYMENT §8). Nothing new is required in `.env`.

## 2026-10-25 (26) — Enamad domain verification (meta tag)

- New site setting «کد اینماد (دسترسی فنی)» (Admin → تنظیمات سایت → عمومی). The root layout adds `<meta name="enamad" content="<code>">` to every page (digits normalized to English; empty → no tag).
- Verified: build ✓, tag present on /, /shop, /contact with Persian-digit input stored; saving in the admin panel updates the tag immediately (cache tag), no rebuild; empty setting → no tag; 214 unit tests ✓.
- Note: Enamad checks `atomgclub.ir`, which ArvanCloud redirects to `www`; if their check doesn't follow redirects, use the meta tag on the www host or ask Enamad support.

## 2026-10-25 (25) — FAQ suggestions in the support chat (owner request, option 2: no external AI)

### Why no AI chatbot
- Major AI APIs don't serve Iran (sanctions/terms) and the 1 GB server can't run a model. The owner chose keyword-based suggestions; an AI provider can be added later on top of the same FAQ data.

### Done
- Model `SupportFaq` (question, answer, keywords, active, order, open/helpful counters), migration `support_faq`, cache tag `faq`.
- `src/features/support/faq-match.ts` (pure, runs in the browser): Persian normalization (ي/ك, digits, ZWNJ), stop words, light stemming (plurals, verb prefixes, multi-letter possessives; one-letter endings compared at match time so «سفارش» isn't cut), question/keyword hits ×3 + answer hits, partial matches, relevance threshold.
- Widget: suggestions box while typing («مشکلم حل شد» clears the draft and counts as helpful; «نه، پیامم را بفرستم» hides it for that text), first 4 FAQs before the first message (hidden while typing), guests get a FAQ search + list above the login prompt.
- Admin `/admin/support/faq` (ADMIN + SUPPORT): add/edit (dialog, validation), activate/deactivate, reorder, delete, stats, and a «امتحان پیشنهادها» tester; linked from the inbox.

### Verification
- `pnpm check` ✓ (214 tests, incl. `tests/unit/faq-match.test.ts`: natural questions, Arabic letters, possessives, unrelated text, limits) · `pnpm build` ✓.
- FAQ E2E (24 checks, all pass): agent creates FAQs (validation), tester match/no-match, reorder, deactivate; guest list (order, max 4, inactive hidden) + search + open answer; user suggestions while typing, «حل شد» (draft cleared, no message, counters 1/1), «نه» then message sent, unrelated text → none, possessive form matched; axe clean; mobile layout; normal user 404 on FAQ admin; delete. Chat E2E 46/46 and smoke 84/84 re-run. Test data removed.

## 2026-10-25 (24) — Branded error page for 502/503/504 (owner request)

- `deploy/errors/50x.html`: self-contained Persian page (brand colors, logo resized from the official file, atom orbits, retry button, quiet HEAD re-check with back-off and auto reload when the site answers, reduced-motion support). Served by nginx, so it works while the app is down or rebuilding.
- Installer: copies the files to `/var/www/atom-errors`, writes `snippets/atom-errors.conf`, includes it in new configs and patches existing ones safely.
- Verified with a real nginx: upstream down → 502 with the page (GET and POST), logo/font 200 with correct types, upstream up → responses pass through (200); `nginx -t` OK on a config patched by the installer's sed; screenshots desktop/mobile, no JS errors.

## 2026-10-25 (23) — Redirect loop fixed by configuration

- After the www → APP_URL redirect went live, the site looped: ArvanCloud redirects `atomgclub.ir` → `www.atomgclub.ir` (301) and the app redirected `www` → apex (308). Confirmed with curl on the server. Fix: `APP_URL="https://www.atomgclub.ir"` (Google had indexed www as well) + rebuild. DEPLOYMENT §5b updated.

## 2026-10-25 (22) — Installer: one run at a time

- Owner's update failed with «Another next build process is already running» (a build from an earlier, interrupted update was still alive on the 1 GB server). `install-server.sh` now takes an exclusive `flock` (`/var/lock/atom-install.lock`) and refuses a second parallel run; while holding it, leftover `next build` processes of the app user are stopped. Verified: `bash -n` ✓, lock refuses a second holder (simulated).
- Follow-up: the error persisted because orphaned build *worker* processes (not named "next build") kept Next's `.next/lock`. The installer now stops whatever holds that file (`fuser -k`, psmisc added to the apt list), also kills leftover worker processes and removes the stale lock. Verified the fuser part with a simulated lock holder (detected → stopped → lock acquirable).
- Root cause on the owner's server turned out to be root-owned files in `.next` ("Build directory is not writeable", EACCES on `.next/trace`), likely from a command run by hand as root. The installer now `chown -R`s the app directory (and the saved previous build) to the app user before doing anything else. `bash -n` ✓.

## 2026-10-25 (21) — www redirect, favicon for Google, site-name structured data

- Catalog restore failed with «درخواست نامعتبر است.»: the owner used `https://www.atomgclub.ir`, but the import route only accepts `Origin` = `APP_URL` (`https://atomgclub.ir`). Google had also indexed the `www` host. `src/proxy.ts` now redirects `www.<APP_URL host>` → APP_URL with 308 (keeps POST); the matcher covers all paths except `_next/static`, `_next/image`, `media/`. Private-area session redirect unchanged.
- Google showed a generic globe instead of the logo: the favicon was 256 px (Google needs a multiple of 48 px). New `src/app/favicon.ico` (48/32/16), `icon.png` 192 px, `apple-icon.png` 180 px — resized from `public/brand/atom-logo.webp`, design unchanged.
- Homepage JSON-LD: `WebSite` (name «ATOM GAME CLUB», alternate «آتم گیم کلاب») + `Organization` (logo).
- Verified: `pnpm check` ✓, `pnpm build` ✓, smoke E2E 84/84, curl: www GET/POST → 308 to the apex, apex 200, icons served with correct types, icon `<link>`s + JSON-LD in the homepage HTML.

## 2026-10-25 (20) — Online support chat (owner request)

### Owner decisions
- Built-in chat (no third-party service), logged-in users only, answered by admins + a new «پشتیبان» role, notifications: panel sound/badge, SMS to staff, SMS/email to the customer.

### Done
- Schema + migration `support_chat`: role `SUPPORT`, `SupportConversation`, `SupportMessage`.
- Customer widget on every public page (floating button, unread badge, guest login prompt, Enter to send / Shift+Enter new line, closed-thread notice, opens from the contact page and from `?support=open` email links, Escape closes, mobile layout).
- Admin: `/admin/support` (open / waiting / closed tabs, search, auto refresh), `/admin/support/[id]` (live thread, reply, close/reopen, "user is on the site" indicator), nav badge + chime, dashboard card. SUPPORT users see only this; `/admin` redirects them there. Role can be assigned in Admin → کاربران.
- Notifications: staff SMS (`SMS_SUPPORT_STAFF_TEMPLATE_ID`, number from site settings), customer SMS (`SMS_SUPPORT_REPLY_TEMPLATE_ID`) or email when they're offline; throttled 15 min per conversation; without templates nothing is sent.
- Site settings group «پشتیبانی آنلاین» (title, welcome, hours, guest text, notify mobile).

### Verification
- `pnpm check` ✓ (207 tests, incl. `tests/unit/support.test.ts`) · `pnpm build` ✓ · smoke E2E 84/84.
- Support E2E against the production build (46 checks, all pass): guest prompt, user messages (multi-line), conversation + unread counters, staff SMS once (throttle), SUPPORT agent redirected and limited to the inbox (other admin pages 404), badge, mark-as-read, reply with staff name (hidden from customer), live delivery to the open widget, unread badge when closed, close → notice → reopen, email to an offline email-only user, SMS to an offline user with a phone, staff APIs 403 for normal users, admin assigns the SUPPORT role, editable widget title, mobile layout, axe clean (fixed: focusable message list), Escape, no page errors. Test data removed.

## 2026-10-24 (19) — Live on atomgclub.ir with HTTPS (ArvanCloud)

- Site deployed on the Iranian server, domain `atomgclub.ir` (DNS on ArvanCloud). certbot failed (Arvan nameservers not visible from abroad, and only a `www` A record existed) → HTTPS via Arvan's edge certificate; 502 fixed by setting the origin protocol to HTTP. Steps recorded in DEPLOYMENT §5b.

## 2026-10-23 (18) — Installer keeps the last working build

- Owner's server went down after an update: `.next` was missing ("Could not find a production build"), so the build step had failed and `next build` had already emptied `.next`.
- `scripts/install-server.sh` now copies the working `.next` to `/srv/atom/next-previous` before building, writes the build output to `/srv/atom/build.log`, and on failure restores the previous build, restarts the service and stops with the log path (shows `free -m` to spot memory problems). `bash -n` ✓; not yet run end-to-end on a server.

## 2026-10-23 (17) — Tournament system (Challonge-style, owner request)

### Owner decisions
- Formats: all — single elimination, double elimination, round robin, groups + knockout.
- Organizers: admin + partners (partners need a plan with the new entitlement `TOURNAMENT_HOST` «برگزاری تورنومنت»; the admin controls it through plans / free grants).
- Registration: online sign-up by users **and** manual names by the organizer. Results: organizer only.

### Done
- Schema + migration `tournaments` (`Tournament`, `TournamentParticipant`, `TournamentMatch`, 4 enums).
- `src/features/tournaments/engine.ts`: pure bracket engine (seeding, byes, single elimination + third place, double elimination + grand final reset, round robin single/double, snake groups, knockout seeding, standings with points → goal difference → goals for → head-to-head → seed, apply/clear results with downstream undo).
- `service.ts` (transactions + row locks), `actions.ts` (create/edit/publish/cancel/delete/start/reset/start knockout, participants add/remove/reorder/shuffle, report/clear results, register/withdraw), `queries.ts` (cached public reads, tag `tournaments`), `permissions.ts`.
- Public `/tournaments` (open registration / in progress / finished; empty state keeps the editable «به‌زودی» text) and `/tournaments/[slug]` (podium, bracket, group tables, rounds, participants with ranks, rules, registration box, live refresh).
- Management: `/admin/tournaments` (+ `new`, `[id]`) for all tournaments, `/partner/tournaments` (+ `new`, `[id]`) for the partner's own; partner dashboard card shows the host status and links there.
- Bug found by E2E and fixed: when a loser dropped into a losers-bracket match whose other side was a bye, the auto-advanced winner was not saved (engine reported the bye match but not the match it filled). `resolveByes` now returns filled matches too; the randomized playout tests now simulate "persist only returned keys" after every step (+ random clear/re-report) and failed 45 cases before the fix.
- Scores and goal difference displayed with Persian digits.

### Verification
- `pnpm check` ✓ (202 tests; engine: 95 incl. playouts for 2–20 players) · `pnpm build` ✓.
- E2E against the production build (44 checks, all pass): partner without `TOURNAMENT_HOST` blocked (dashboard, list, /new); partner creates single elimination, draft hidden publicly, publish, two users sign up (duplicate name refused, withdraw + re-register), manual names, capacity full message, other partner/user get 404 on manage pages; start, tie with chosen winner, third-place match, ranks 1–4, public podium + bracket, axe clean; admin sees partner tournaments with organizer; double elimination with grand final reset and ranks, clearing the final result reopens it; round robin with a draw (no winner stored) and ranks; groups + knockout (2×4, top 2) — semis pair different groups, ranks 1–4 then shared group ranks; mobile page without horizontal scroll; reset keeps participants; audit entries; no page errors.
- All `[TEST]` users, plans and tournaments removed afterwards.

## 2026-10-23 (16) — Gamepad Tester live (owner request)

### Done
- Owner asked to make the Gamepad Tester usable → `GAMEPAD_TESTER_ENABLED = true`. Access: entitled partners (unchanged `hasEntitlement`) **and admins** (`canUseGamepadTester`).
- Browser tester (`src/components/gamepad-tester/gamepad-tester.tsx`, Gamepad API, no server calls): controller detection (DualSense / Edge / DualShock 4 / Xbox / generic) and multi-controller picker; all buttons with live state and "tested" tracking + progress; analog L2/R2 bars; both sticks with live X/Y/|r|, deadzone ring; 3-second drift test with verdict; stick range (circularity) test with coverage; vibration (weak / strong / both, `dual-rumble`); text report with copy-to-clipboard; reset; HTTPS / unsupported-browser / waiting states.
- Pure analysis in `src/features/gamepad-tester/analysis.ts` + `tests/unit/gamepad.test.ts` (found and fixed: "Xbox Wireless Controller" was detected as PlayStation).
- Owner pointed to dualshock-tools.github.io (WebHID: stick calibration, battery/firmware/serial, speaker/mic/IMU/lights tests). It is MIT-licensed, but building or reading its code was blocked by this environment's safety policy, and writing calibration reports from memory risks damaging controllers, so calibration is **not** implemented. Options left to the owner (see chat).

### Verification
- `pnpm check` ✓ · `pnpm build` ✓ · E2E with a simulated DualSense (17 checks, all pass): locked for guests, waiting state, detection, button/trigger tracking, stick values, drift verdicts (0.150 drift / 0.020 clean), range verdicts (full vs 0.8), vibration call, report + clipboard, reset, disconnect, no console errors.
- Note: browsers expose controllers only on HTTPS (or localhost); on `http://<IP>` the page explains this.

## 2026-10-22 (15) — Local install cancelled

- Owner cancelled the local (PC) install and wants the site on a server. Removed `scripts/setup-local.mjs`, `start-atom.bat` and the README section.
- Kept what servers in Iran also need: `scripts/prisma-generate.mjs` and the direct-SQL migration fallback, now `scripts/migrate.mjs` behind `pnpm db:deploy`.

## 2026-10-22 (14) — Hosting check + local install

### Owner's cPanel host
- Offers only MySQL (no PostgreSQL); Node.js version unknown. Not deployed there. Recommended: ask the host for PostgreSQL ≥ 14 + Node.js ≥ 22 + Terminal; otherwise an Iranian VPS or a PaaS with PostgreSQL (e.g. Liara). Porting to MySQL is possible but touches stock reservation, rate limiting, search and plan features → only on explicit request.
- The owner sent a cPanel session URL; it was not opened. Advised to log out to invalidate it.

### Local install
- `pnpm setup:local` (`scripts/setup-local.mjs`): checks Node ≥ 22.12, writes `.env` (generated AUTH_SECRET, LAN-IP hint), creates the database, applies migrations (falls back to applying the SQL files directly with Prisma-compatible `_prisma_migrations` rows if Prisma's engine can't be downloaded), builds, creates the first admin, optionally imports `catalog.db`. Re-runnable.
- `start-atom.bat` for Windows (CRLF via `.gitattributes`), binds 0.0.0.0:3000 for LAN access.
- `scripts/prisma-generate.mjs` (used by `postinstall`, `build`, `db:generate`): `prisma generate` downloads the schema engine from binaries.prisma.sh when missing even though generation doesn't need it; that failed on the owner's Windows PC ("Can't resolve '@/generated/prisma/client'"). The script retries with `PRISMA_SCHEMA_ENGINE_BINARY` set to a placeholder file. Verified offline with the engine removed.
- Tested end to end with fresh databases: normal path (85 catalog games imported, admin login, catalog page) and fallback path (engine unavailable → 6 migrations applied directly → `prisma migrate status`: up to date). Test databases and files removed; dev data intact.

## 2026-10-22 (13) — Phase 12 completed (QA, hardening, deployment)

### Security review
- Every exported Server Action (60) and route handler checked: admin actions call `assertRole(["ADMIN"])`; user actions require a session and scope queries to the user's own rows (addresses, orders, cart items, sessions); public actions are rate limited. Added a type check in `deleteAddress`.
- Raw HTML only in: sanitized rich text, escaped JSON-LD, server-generated QR SVG. No open redirects (`safeRedirectPath`).
- No secret in the git history (SMS key, AUTH_SECRET checked); `.env`, databases and uploads are not tracked. `pnpm audit --prod`: no known vulnerabilities.

### Hardening
- CSP (same-origin only; inline scripts allowed because nonce CSP is incompatible with Partial Prerendering), COOP, HSTS and `upgrade-insecure-requests` when `APP_URL` is https. The media route keeps its stricter sandbox CSP (fixed: the global header had overridden it).
- `robots.txt` (private areas disallowed), `sitemap.xml` (static pages + active products + published news), `metadataBase` + OpenGraph defaults.
- `pnpm maintenance` with `--dry-run` and `--media`; tested with fixtures: an old unreferenced upload and a stray file were removed, an upload referenced inside page HTML and a fresh upload were kept. Bug found and fixed before use: wrong column names in the rich-text reference query.
- `scripts/backup.sh`: pg_dump (custom format, verified) + uploads tarball, owner-only, retention. **Restore tested** into a scratch database (85 catalog games restored).
- `docs/DEPLOYMENT.md` rewritten: env table, server prep, systemd unit bound to 127.0.0.1 (prevents IP spoofing around nginx), nginx with per-route body limits and static caching, cron, restore, updates/rollback, go-live checklist, CSP note for payment gateways.

### QA
- Full sweep on the production build with fixtures (89 checks, all pass after fixes): 17 public, 5 user and 18 admin pages → HTTP 200, CSP header, `lang=fa dir=rtl`, no console errors, **no CSP violations**, **no serious/critical axe (WCAG 2 A/AA) issues**; rich-text editor works under CSP; mobile overflow; 404 status; media headers; media path traversal blocked. Fixed: invalid list markup in the shop category sidebar (axe `list`), media CSP override.
- Regression under the new headers: Phase 9 (catalog, 43), Phase 10 (partners, 40), Phase 11 (gamepad/grants, 30) suites re-run; only outdated test expectations failed (updated). Real catalog verified identical to the owner's file again (85/85).
- New `pnpm test:e2e` read-only smoke test in the repo: 84/84 pass.
- `pnpm check` ✓ · `pnpm build` ✓. All QA data removed.

### Waiting on the owner
- Payment gateway provider + credentials (then implement the provider, check CSP `form-action`, and open sales from the admin panel).
- SMTP mailbox on the site domain (email codes/notifications).
- Domain + Iranian VPS to deploy (follow `docs/DEPLOYMENT.md`); regenerate the SMS.ir API key.
- Rename the 50 catalog games flagged «نیاز به تغییر نام».

## 2026-10-22 (12) — Manual subscription grants + Phase 11 (tournament & Gamepad Tester placeholders)

### Owner decision
- Admins may grant a free (manual) subscription to approved partners while online purchase is disabled.

### Done — manual grants
- `grantSubscription` / `cancelSubscription` (ADMIN, Zod, audit). Only for APPROVED partners; partner row locked (`FOR UPDATE`) so parallel grants can't overlap; a renewal queues right after the latest active period (`nextGrantStart`); the note records "اعطای دستی توسط <admin>" + optional note. No payment rows are created.
- Admin partner detail: subscription list with derived phase (فعال / شروع در آینده / منقضی / لغوشده), «اعطای اشتراک رایگان» dialog (plan, days prefilled from plan, note), cancel with confirmation. Subscriptions page uses the same phases. Partner dashboard shows the upcoming period.
- Suspension keeps subscription rows but `hasEntitlement` denies access; re-activation restores it.

### Done — Phase 11
- `/tournaments` unchanged (required text, editable). `src/features/tournaments/index.ts`: `TOURNAMENTS_ENABLED = false` + scope note; no tables, no bracket/result logic.
- `/tournaments/gamepad-tester`: editable page text + access panel decided on the server by `getGamepadAccess()` → `hasEntitlement(userId, "GAMEPAD_TESTER")`: anonymous (login), admin (not auto-entitled), no application, pending, rejected, suspended, no subscription, granted. Granted partners see «دسترسی شما فعال است» and a disabled «ابزار تست به‌زودی» area; `GAMEPAD_TESTER_ENABLED = false`, no tester code.
- New editable texts (Admin → تنظیمات سایت → تورنومنت): locked message, granted message.
- Admin `/admin/tournaments` placeholder (nav enabled) linking to the tournament texts.

### Verification
- `pnpm check` ✓ (typecheck, lint, 101 unit tests incl. phase/renewal rules) · `pnpm build` ✓.
- E2E on the production build (30 checks, all pass on first run): every access state of the Gamepad Tester page, grant hidden before approval, duration validation, grant stored with admin name, plan without the feature keeps access locked, renewal queued after the current period, upcoming shown to partner, cancel, entitled partner sees the disabled tool area (no controls), dashboard access, suspension locks and re-activation restores, expiry locks, admin placeholder, editable locked text, user gets 404 on admin.
- Test data removed afterwards (users, partners, plans, subscriptions, settings). Catalog untouched (85 games).

## 2026-10-22 (11) — Phase 10 completed (partners & subscriptions, purchasing disabled)

### Done
- Migration `partners_review`: `PartnerProfile.submittedAt` (review queue order), `SubscriptionPlan.isVisible`.
- Public `/partners`: editable intro (new site-settings group «همکاران»), service points, visible plans with a disabled «به‌زودی» button, CTA that adapts to the visitor (guest / applicant with status / admin).
- `/partner` (login required, also in proxy matcher, account nav and header menu): application form → pending (editable) → rejected (reason shown, resubmit) → approved dashboard (subscription card, Gamepad Tester access state, tournaments note, plans, editable contact info with business name/type locked) → suspended (reason, no edits). Admins cannot apply.
- Validation: Iranian mobile/landline normalized to 11 digits, Instagram URL/handle → handle, website https only, province from the 31-province list.
- Admin `/admin/partners`: status tabs with counts, search (business, city, phones, email, name), oldest-pending-first, detail page with approve / reject (reason required) / suspend (reason required) / re-activate. The PARTNER role mirrors APPROVED in the same transaction (admins keep ADMIN); sessions read the role from the DB, so no logout is needed. Users admin can no longer set/unset PARTNER (points to همکاران instead). Dashboard card «درخواست‌های همکاری».
- Admin `/admin/subscriptions`: plan CRUD (code, name, description, Toman price, days, features, visibility, order); plans with history cannot be deleted; `isActive` is never settable (always false) and `SUBSCRIPTION_PURCHASE_ENABLED = false`. Read-only list of partner subscriptions.
- `hasEntitlement(userId, "GAMEPAD_TESTER")` (`src/features/subscriptions/entitlements.ts`) — server-side, DB-backed; pure rule in `entitlement-rules.ts`: active user + role PARTNER + profile APPROVED + subscription ACTIVE within its period + plan includes the feature.

### Verification
- `pnpm check` ✓ (typecheck, lint, 98 unit tests incl. 13 new for entitlements, phone/Instagram normalization, application and plan schemas) · `pnpm build` ✓.
- E2E on the production build (40 checks, all pass; one selector mismatch in the test was re-verified manually): guest CTA and login redirect, field errors, `javascript:` website rejected, submit/edit pending, user gets 404 on admin, dashboard card, list/search/detail, reject requires reason, user sees reason and resubmits (reason cleared), approve → PARTNER, dashboard without subscription, locked business name, contact edit, header link, plan create/duplicate code/hidden plan, price in Toman, disabled «به‌زودی», a test ACTIVE subscription row grants access, used plan not deletable, suspend → USER and no access, re-activate, users-admin guard, admin can't apply, editable page title, no mobile overflow, no page errors.
- All test users, profiles, plans, subscriptions and settings removed afterwards. Catalog data untouched (85 games).

### Open question for the owner
- Should admins be able to grant a free/manual subscription (e.g. for trusted partners) before online purchase exists? Not implemented — it changes business rules.

## 2026-10-22 (10) — Phase 9 completed (Game Catalog port)

### Done
- Data model: `CatalogCategory`, `CatalogGame` (original 12-hex IDs kept, `position` = original order), `CatalogImportRun`; migration `catalog_position`.
- Importer (`src/features/game-catalog/importer.ts`): reads the original `catalog.db` read-only with `node:sqlite` (schema v1 and v2, integrity check), re-encodes every BLOB image to WebP via the shared upload pipeline, swaps the catalog in one transaction, cleans up old/new media on success/failure. Available as `pnpm catalog:import <file>` and from the admin panel.
- Public `/game-catalog` (platform cards) and `/game-catalog/ps4|ps5`: instant search (Persian-normalized), category chips with counts, grid grouped by category, lightbox (prev/next buttons, ← → keys like the original, Esc, swipe, counter), lazy images, live refresh (polls `/api/catalog/version` every 30 s while the tab is visible → `router.refresh()`).
- Admin `/admin/game-catalog` (ADMIN only; nav entry enabled): PS4/PS5 tabs; single + bulk upload with drag-and-drop, names from file names (editable before upload), browser-side downscale, one file per request; per game: edit name/category, replace image, move to other platform, delete (confirm); «نیاز به تغییر نام» badge + filter; categories: add, rename (merge on conflict), delete (games → «بدون دسته»), reorder; locked default category; QR codes of the public pages (print / SVG download); backup: ZIP export (`catalog.json` in the original shape + `images/<id>.webp`) and restore from `.db` with confirmation.
- Route handlers: `GET /api/catalog/version`, `GET /api/admin/catalog/export` (ADMIN), `POST /api/admin/catalog/import` (ADMIN + same-origin check, 200 MB cap streamed to a private temp file, one import at a time, rate limited, audit logged).
- All mutations: server-side ADMIN check, Zod validation, `updateTag(catalog)`, audit log. Removed an unused exported server action that had no auth check.

### Verification
- `pnpm check` ✓ (typecheck, lint, 85 unit tests) · `pnpm build` ✓.
- E2E on the production build with the owner's real data (43 checks; all pass after fixes): counts 56/29, chips, search, empty state, lightbox keys/buttons/wrap/Esc/swipe, WebP covers, unknown platform 404 UI, no horizontal overflow on mobile, bulk upload + category creation, rename flag, **live refresh in 27 s without reload**, edit, empty name blocked, image replace (old media deleted), move platform keeps category name, category add/reorder/merge/delete, game delete, ZIP valid with all images and original JSON keys, foreign-Origin import refused even when logged in, invalid file refused with catalog unchanged, v1-schema import (IDs kept, all to PS4), re-import of the real DB, anonymous export 403.
- After the run the real catalog was restored from the owner's file and compared row by row with the source (id, platform, category, name, order): **identical, 85/85**; source file SHA-256 unchanged; 85 media rows = 85 files.
- Bugs found and fixed: swipe used stale state when events arrived quickly (now a ref); a non-SQLite file gave a generic 500 instead of a clear message.

### Data finding
- 50 PS4 games have placeholder names: 49 are `images` / `images (1)`…`images (47)` (bulk-upload file names) and 1 contains image dimensions (`… 321x400`). The earlier analysis counted only the two exact `images`. They are shown with the «نیاز به تغییر نام» badge; the owner should rename them in the panel.

## 2026-10-22 (9) — Phase 8 completed (news, contact, about, editable site texts)

### Done
- Rich text: shared Tiptap extensions, server-side sanitizer (allow-listed nodes/marks, links http(s)/mailto/tel/relative only, images only `/media/...`), server HTML rendering, editor with toolbar (headings, marks, lists, quote, rule, alignment, links, image upload, undo/redo), `.prose-atom` styles.
- Site settings: 4 groups / 44 fields with validation (https URLs, emails, phones normalized) and defaults; admin "تنظیمات سایت" with tabs (sales, home, about, contact, general, tournaments). Public pages read them (homepage, footer, meta description, tournaments, gamepad tester).
- About page editor + public page. News: categories, posts, admin list/form, public list/article. Contact: page, form, admin inbox. Dashboard cards.

### Verification
- `pnpm check` ✓ (typecheck, lint, 80 unit tests incl. sanitizer/XSS and settings schema) · `pnpm build` ✓.
- E2E on the production build (23 checks, all pass): editing homepage texts and fallback to defaults, unsafe social URL rejected, contact info in page + footer, tournament text, meta description/copyright, About rich text, news category/draft/publish/featured/unpublish, article renders list + safe link (`noopener`) + uploaded image, NewsArticle JSON-LD, editor refuses `javascript:` links, **malicious JSON sent directly to the Server Action** stored as escaped/safe HTML, contact anti-spam (too-fast → fake success, nothing stored), validation, hashed IP, inbox read/archive, rate limit.
- Bugs found and fixed: (1) news save crashed — ProseMirror null-prototype attrs can't be sent to Server Actions → editor now emits plain JSON; (2) adding a link with no selection did nothing → inserts the URL as a link; (3) inserting an image right after linking replaced the linked text → selection collapses after linking; (4) `Date.now()` in the contact form ran at build time → moved to the browser; (5) typing into pre-filled admin fields during hydration could prepend text → inputs disabled until hydrated.
- All test data and uploads removed.

## 2026-10-22 (8) — Shipping methods incl. «پس‌کرایه»

### Owner request
Admin can add shipping companies; for «پس‌کرایه» the carrier sets the fee, collected on delivery without the site's gateway.

### Done
- `ShippingMethod` (type COLLECT / PREPAID, price, description, tracking URL template, active, order) + order snapshot fields (`shippingMethodName`, `shippingType`, `trackingCode`, `trackingUrl`); CHECK: COLLECT price must be 0.
- Admin → روش‌های ارسال (create/edit/delete, https + `{code}` validation). Flat shipping removed from sales settings.
- Cart shows "shipping chosen at checkout"; checkout lists active methods with a live summary («مبلغ قابل پرداخت آنلاین»); پس‌کرایه excluded from the online amount with a clear notice.
- `placeOrder` validates the method server-side; admin enters a tracking code when shipping; customer sees code + carrier link.

### Verification
- `pnpm check` ✓ (70/70) · `pnpm build` ✓.
- E2E with the sandbox gateway (16 checks, all pass): method CRUD and validation, only active methods listed, prepaid total adds 80,000, پس‌کرایه total excludes shipping and shows the carrier notice, deactivated method refused by the server, gateway amount = goods only, order snapshot (COLLECT, shipping 0), tracking link `…?code=TPX%20778899` with `noopener`, deleting a used method keeps the order snapshot.
- Test data removed.

## 2026-10-22 (7) — Phase 7 completed (cart, checkout, orders)

### Owner decisions
- Shipping paid with the order through the gateway (flat amount set in admin, default 0).
- Online sales stay closed; the owner opens them from the admin panel once the gateway is connected (gateway API will be sent).
- Per-category «جهت استعلام قیمت تماس بگیرید».

### Done
- Schema: `categories.priceOnRequest`, `orders.paymentDeadline` (migration `commerce`).
- Settings: `commerce` (salesEnabled, shippingCost, priceInquiryPhone) + Admin → تنظیمات فروش.
- Payments: provider interface, dev-only sandbox gateway + sandbox page, callback route.
- Cart, checkout, addresses, order service (reserve / cancel / expire / late payment), customer orders pages, admin orders pages, dashboard order stats, header cart icon, product purchase box.

### Verification
- `pnpm check` ✓ (typecheck, lint, 70/70) · `pnpm build` ✓.
- Production build with sales closed (12 checks): closed notices, no cart icon/button, price-on-request on product + listing + sub-category, no price in JSON-LD, open-sales button disabled.
- Direct Server Action calls over HTTP (bypassing the UI): admin can't open sales without a gateway; USER gets «دسترسی غیرمجاز» for 5 admin actions (DB unchanged); anonymous calls never execute; cross-origin call rejected by Next's CSRF check; addToCart refused while closed.
- Dev server + sandbox gateway (27 checks): guest cart + merge on login, address validation, payment success (PAID, reference, stock 5→3, cart emptied), payment failure (cancel + restore), expiry auto-cancel, late payment re-reserve, callback replay idempotent, last-unit race (one buyer reaches the gateway, the other gets "insufficient stock", stock 0 — re-verified), order ownership, admin PAID→PROCESSING→SHIPPED with tracking note visible to the customer, admin cancel restores stock, cart blocks unavailable products, inventory history. Two checks first failed only because the test expected Rial instead of Toman amounts (DB totals verified correct).
- Bugs found and fixed: interim `/game-catalog/[platform]` read params outside Suspense (background regeneration error); account nav `usePathname()` on a dynamic route broke the build; cart reads needed `connection()`; admin order page too cramped at 1280px.
- All test data removed; `PAYMENT_PROVIDER` remains disabled.

## 2026-10-22 (6) — Phase 6 completed (store & product management)

### Owner input
- SMS.ir verify template ID received (490537) → `.env`; production switch documented in `docs/DEPLOYMENT.md`.

### Done
- Media pipeline: `storeImage()` (sharp decode → validate format → EXIF rotate → resize ≤1600px → WebP), `uploadImages` Server Action (ADMIN only, rate-limited, one file/request, 6 MB global body limit), `/media/[...key]` route.
- Admin: categories page + dialog; products list (search, status/category/low-stock filters, pagination), create/edit form (auto Persian slug, Toman price hints, image manager with ordering/alt), stock dialog + movement history, delete (blocked if used in orders → archive).
- Public: `/shop` listing and `/shop/[slug]` detail (replacing the interim page); homepage featured products now link to real pages.
- Helpers + tests: `slugify`, `normalizePersian`, `parseTomanToRial`, unique-violation helpers (67 unit tests).
- `docs/DEPLOYMENT.md` draft (env, nginx headers, backups).

### Verification
- `pnpm check` ✓ (typecheck, lint, 67/67) · `pnpm build` ✓.
- E2E in Chromium (36 checks, all passing after one fix): Persian slug generation; parent/child categories; fake image (HTML in .png) rejected; 2400px PNG + JPEG uploaded and served as WebP with nosniff/immutable; 4 path-traversal URLs → 404; discount validation; duplicate SKU field error; draft hidden from listing and direct URL; search, category (incl. sub-category) and in-stock filters; featured on homepage; product page (price, discount, "only 3 left", gallery, text-only description, JSON-LD IRR); stock can't go negative; out-of-stock visible immediately after admin change; category with products not deletable; USER gets 404 on admin store pages.
- Bugs found and fixed during verification: (1) header nav `usePathname()` broke the build on dynamic routes → Suspense boundaries; (2) duplicate SKU showed the wrong message because Prisma 7 reports constraints differently → `uniqueViolationTarget()`; (3) avatar initial used "[" → first letter.
- All test data, uploaded files and audit rows removed.

### Next
- Phase 7: cart (guest + user), checkout with addresses, orders with stock reservation, order history, admin order management, payment provider interface (disabled).

## 2026-10-22 (5) — GitHub connected, Phase 5 completed (auth & authorization)

### Owner input
- GitHub repo `mrx8384/gamenetsite` → full history pushed to `main`.
- SMS provider confirmed: SMS.ir. Email mailbox later. Request: all site texts editable from admin (added to Phase 8).

### Decision
- Custom database sessions instead of Auth.js (reasons in ARCHITECTURE §2). New `sessions` table (migration `sessions`).

### Done
- Auth core: argon2id passwords, DB sessions, DAL (`getCurrentUser`, `requireUser`, `requireRole`, `assertUser`, `assertRole`), one-time codes, PostgreSQL rate limiter, audit log, Iranian mobile/email normalization (Persian digits accepted), safe redirects.
- Senders: SMS.ir verify API (inactive until template ID is set) + log mode; email log mode.
- Pages: `/login` (password or code), `/register` (2 steps with code), `/forgot-password`, `/account` (name, mobile/email change with code), `/account/security` (password change, devices list, revoke).
- Header account menu (login button or dropdown with admin link for admins).
- Admin: protected shell with module sidebar (future modules shown disabled), dashboard with user counts, users management with confirmations and toasts.
- `proxy.ts` optimistic redirects; `pnpm admin:create` (interactive or env-driven, no default password).
- Unit tests: identifiers, crypto, password policy, user-agent (50 tests).

### Verification
- `pnpm check` ✓ (typecheck, lint, 50/50 unit tests) · `pnpm build` ✓.
- End-to-end in Chromium against the production build (27 checks): proxy redirect; registration with code (wrong code rejected, Persian digits normalized); cookie httpOnly + SameSite=Lax; logout; wrong password rejected; USER gets 404 on `/admin`; code login on mobile; sessions list + revoking another device; password reset logs out other devices; admin login with `next`; dashboard; role change (logs user out); deactivation (blocks login); admin can't modify self; rate limit triggers. One check initially failed because of a wrong test value; re-verified manually (search works).
- All test accounts, codes, sessions and audit rows deleted afterwards.

### Known limitations
- SMS.ir and SMTP not testable from the dev environment (network policy); verify on the Iranian server.
- Redirects inside streamed pages happen client-side (after the shell); security is unaffected because content renders only after the server check.

## 2026-10-22 (4) — Phase 4 completed (homepage + public layout)

### Owner input
- GitHub: owner agreed, but no GitHub account is connected to this session yet → still no remote. Work committed locally only.
- SMS API key received → stored only in `.env` (git-ignored, not in docs). Could not verify: Iranian SMS APIs are blocked from this environment.
- Email: recommended host SMTP mailbox (see ARCHITECTURE §6). "images" games: keep as-is, flag for renaming in catalog admin.

### Done
- Public layout via `(public)` route group: sticky header (brand, desktop nav with active state), RTL slide-in mobile menu (Radix Dialog), dark footer with Jalali copyright year, skip-to-content link; 404 page also uses header/footer.
- Homepage: hero (unmodified logo + animated atom orbits, reduced-motion safe), featured products, catalog preview (game count + recent covers per platform), tournament band, partner services, latest news, about teaser.
- Data layer: `getFeaturedProducts`, `getLatestNews`, `getCatalogStats` (`"use cache"` + tags), reusable `ProductCard` and `NewsCard`.
- `/tournaments` placeholder with the exact required text; interim pages for routes of later phases.
- Unit tests for navigation helpers (21 tests total).

### Verification
- `pnpm check` ✓ (typecheck, lint, 21/21 tests) · `pnpm build` ✓ (home = partial prerender; others static).
- Production server: all public routes 200, `/design-system` 404, image optimizer 200.
- Empty DB: sections show Persian empty states. With temporary `[DEV]` rows: featured products, prices in Toman, discount and out-of-stock badges, published news and catalog count render; drafts are **not** shown. Dev rows deleted afterwards (0 remaining).
- Browser (1366px / 390px): no horizontal overflow, no JS errors; mobile menu opens, navigates, closes and releases scroll lock; active nav item marked with `aria-current`.
- Fixed during verification: discount percentage shown with Latin digits.

### Known limitations
- `/game-catalog/<unknown>` shows the 404 page with HTTP 200 (Cache Components streaming); interim page, fixed in Phase 9.
- Header account/cart actions arrive in Phases 5 and 7.

## 2026-10-22 (3) — Owner decisions, Phase 2 approved, Phase 3 completed

### Decisions recorded
Option C for the catalog (admin behind password login), Python app retired after launch, ZIP export, Toman, email + SMS auth, Iranian hosting. See `CLAUDE.md` §2.

### Done
- Inspected the live `catalog.db` read-only (85 games, 7 categories, all images valid). Details in `docs/GAME_CATALOG_ANALYSIS.md` §11.
- Initialized Next.js 16.4 + React 19.3 + TypeScript 5.9 + Tailwind 4.3 (pnpm).
- Design system: brand tokens (`globals.css` + `src/lib/brand.ts`), Vazirmatn self-hosted, light theme (dark tokens prepared), RTL for Radix via `Direction.Provider`, reduced-motion support.
- UI primitives in `src/components/ui/` (shadcn style, written by hand because the shadcn registry is blocked from this environment).
- `src/lib`: env validation (Zod), Prisma client (adapter-pg), Persian formatting (digits, Toman, Jalali dates), contrast helper.
- Prisma schema for all modules (27 tables) + CHECK constraints and partial unique indexes; migration `init` applied to local PostgreSQL.
- `/api/health` (DB check), security headers, Persian 404/error pages, `/design-system` reference page (404 in production).
- Unit tests: formatting + brand contrast/token sync (18 tests).

### Verification
- `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` 18/18 ✓ · `pnpm build` ✓
- Production server: `/` 200, `/design-system` 404 (hidden in prod), `/api/health` 200 with DB up and 503 with DB stopped, unknown route → Persian 404, security headers present.
- Browser check (Chromium, 1280px and 390px): Vazirmatn loaded, no horizontal overflow, no console errors; confirm dialog, form validation messages and toasts work. Fixed two issues found this way (dialog off-center during animation; Latin digits shown as Persian because of a font feature).

### Not done / notes
- No Git remote yet: work exists only in this temporary environment (committed locally).
- Homepage is a temporary placeholder until Phase 4.

### Next
- Phase 4: homepage + public layout (header, footer, mobile navigation, sections).

## 2026-10-22 (2) — Phase 1 completed

### Done
- Received `game-catalog.zip` and the logo.
- Checked the archive before extracting (4 files, no path traversal). Extracted into an isolated scratch folder.
- Read `server.py` (all 1,904 lines) and `DATABASE.md`. Documented architecture, DB schema, 17 endpoints, 17 features, business rules and security findings in `docs/GAME_CATALOG_ANALYSIS.md`.
- Baseline test: ran the original app in an isolated copy with an empty DB and exercised every endpoint. All worked.
- Preserved originals unchanged: `services/game-catalog/` (checksums match the archive), logos in `public/brand/`.
- Updated `CLAUDE.md`, `docs/ARCHITECTURE.md` (catalog schema), `docs/ROADMAP.md`.

### Key findings
- The archive contains **no data** (`data/catalog.db` is missing). Live data is on the owner's PC.
- The original admin is protected only by a localhost check and has no CSRF protection, so a plain reverse proxy would make everyone an admin.
- Recommendation: option C (port into Next.js + PostgreSQL, with a lossless importer). **Awaiting approval.**

### Verification
- Baseline endpoint test passed (see analysis §6). No application code written yet.

## 2026-10-22 — Phase 1 (partial) + Phase 2 (draft)

### Done
- Inspected the environment: project folder was empty.
- Searched for `game-catalog.zip`, `server.py`, `DATABASE.md` and the logo across the filesystem and upload folders: **not found**. Google Drive connector failed to connect.
- Checked available tooling: Node 22.22, pnpm 10.28, Python 3.13, PostgreSQL 16.
- Created `CLAUDE.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/GAME_CATALOG_ANALYSIS.md`, `docs/PROGRESS.md`.
- Drafted architecture, security design, database schema, design tokens and integration options for the catalog.

### Not done / blocked
- Game Catalog analysis (no archive) — resolved in entry (2).
- No code written (by instruction: wait for approval).

### Verification
- Documentation only; nothing to test yet.

### Next
- Owner uploads `game-catalog.zip` + logo and provides a Git repo.
- Owner approves architecture/schema and answers open decisions in `docs/ROADMAP.md`.
- Then: finish Phase 1 analysis → start Phase 3.
