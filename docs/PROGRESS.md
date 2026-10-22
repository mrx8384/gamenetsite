# Progress Log

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
