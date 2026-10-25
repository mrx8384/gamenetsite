# Progress Log

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
