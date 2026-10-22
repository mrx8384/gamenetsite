# CLAUDE.md — ATOM GAME CLUB

Project memory for AI assistants and developers. Keep this file current after every phase.
**Never put passwords, API keys, tokens or other secrets in this file.**

## 1. Project overview

ATOM GAME CLUB is a Persian-first (fa-IR, RTL) gaming platform:

- Public site: homepage, store, news, about, contact
- Store with cart, checkout, orders (payment gateway configurable, **disabled** until provider + credentials are supplied)
- Auth with roles `ADMIN`, `USER`, `PARTNER`
- Partner registration, approval workflow, dashboard, subscription architecture (**paid subscriptions disabled**)
- Existing **Game Catalog** (Python, from `game-catalog.zip`) integrated under `/game-catalog`
- Tournaments: **frontend placeholder only** — message «بخش تورنومنت به‌زودی فعال می‌شود.»
- Gamepad Tester at `/tournaments/gamepad-tester`: **placeholder only**, gated for approved partners with an active subscription
- One centralized admin panel at `/admin`

Communication with the owner: **Persian**. Code, comments, technical docs: **English**.

## 2. Current status

- Phase 1 (analysis): **done** — see `docs/GAME_CATALOG_ANALYSIS.md`. Original catalog preserved in `services/game-catalog/`; logo in `public/brand/`.
- Phase 2 (architecture + schema): **approved** (2026-10-22). Schema implemented in `prisma/schema.prisma`, first migration applied.
- Phase 3 (project init + design system): **done**.
- Phase 4 (homepage + public layout): **done**.
- Phase 5 (authentication & authorization): **done**.
- Phase 6 (store & product management): **done**.
- Phase 7 (cart, checkout, orders) + shipping methods: **done**.
- Phase 8 (news, contact, about, editable site texts): **done**.
- Phase 9 (Game Catalog port + import): **done**. Real catalog (85 games) imported.
- Phase 10 (partners & subscriptions, purchasing disabled): **done**.
- Manual (free) subscription grants by admin: **done** (owner approved 2026-10-22).
- Phase 11 (tournament + Gamepad Tester placeholders with the entitlement boundary): **done**.
- Phase 12 (QA, hardening, CSP, maintenance, deployment guide): **done**. All planned phases complete.
- Hosting: the owner's cPanel host has only MySQL → not used (see PROGRESS 14). Local install was cancelled by the owner (deploy to a server instead). Waiting on the owner for: payment gateway details, SMTP mailbox, domain/hosting to deploy.
- Code is on GitHub: `mrx8384/gamenetsite` (branch `main`).

### Owner decisions (2026-10-22)
- Game Catalog: **option C approved** (port into Next.js + PostgreSQL). Catalog admin must require login with password (ADMIN role).
- The original Python app will **not** be used after launch → no sync needed.
- Catalog export: ZIP (`catalog.json` + images) + import from the original `.db`. No `.db` export.
- Prices displayed in **Toman** (stored as Rial).
- Login and password recovery via **both email and SMS**.
- Hosting: **Iranian host** → no external CDNs/fonts at runtime, Iranian SMS + payment providers.
- SMS provider: **SMS.ir** (confirmed), verify template ID `490537` (not secret; stored in `.env`). API key stored **only** in `.env`. `SMS_PROVIDER` stays `log` until a verify template ID exists (`SMS_TEMPLATE_ID`) and the key is tested from the Iranian server (SMS.ir is unreachable from the dev environment).
- Commerce (owner decisions, Phase 7): online sales **closed** by default; admin opens them from Admin → تنظیمات فروش, but only when a real payment gateway is configured. Shipping = **shipping methods** managed in Admin → روش‌های ارسال: `COLLECT` («پس‌کرایه»: carrier sets the fee and collects it on delivery, not via the site gateway) or `PREPAID` (fixed fee paid online with the order). Customer picks one at checkout; orders snapshot name/type and get a tracking code (+ optional carrier tracking URL template with `{code}`). Categories can be marked **«جهت استعلام قیمت تماس بگیرید»** (inherited by sub-categories): price hidden, phone shown, not purchasable. Gateway API details will be supplied by the owner → implement a `PaymentProvider` in `src/features/payments/providers/` and register it in `index.ts`.
- **All site text must be editable from the admin panel** (owner request) → Phase 8 site settings cover homepage, footer, about, contact and tournament texts.
- Email: recommended the host's SMTP mailbox on the site domain (see ARCHITECTURE §6). Awaiting domain/mailbox.
- Admins may grant free subscriptions to approved partners (Admin → همکاران → partner → «اعطای اشتراک رایگان»); online purchase stays disabled.
- Catalog games with placeholder names (49 × `images (N)` + 1 with dimensions): imported as-is and flagged «نیاز به تغییر نام» in the catalog admin; owner to rename.

Detailed log: `docs/PROGRESS.md`. Plan: `docs/ROADMAP.md`.

## 3. Technology stack (proposed, pending approval)

| Area | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack, **Cache Components on**), React 19.3, TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 4.3, shadcn/ui pattern on `radix-ui` 1.8 (RTL via `Direction.Provider`), Lucide icons, Vazirmatn variable font (self-hosted in `src/app/fonts`) |
| Data | PostgreSQL 16, Prisma 7.10 (`prisma-client` generator → `src/generated/prisma`, `@prisma/adapter-pg`, config in `prisma.config.ts`) |
| Auth | **Custom database sessions** (per the official Next.js auth guide) instead of Auth.js — see ARCHITECTURE §2. argon2id (`@node-rs/argon2`) |
| Validation / forms | Zod 4, React Hook Form 7 + `@hookform/resolvers` |
| Toasts | sonner |
| Rich text | Tiptap 3.31 (StarterKit, Image, TextAlign, Placeholder). Editor emits JSON; server sanitizes (`src/lib/rich-text/sanitize.ts`) and renders HTML with `@tiptap/html/server` — raw HTML from clients is never stored |
| Tests | Vitest 4 (unit, `tests/unit`), `playwright-core` + `@axe-core/playwright` read-only smoke test (`tests/e2e/smoke.mjs`, `pnpm test:e2e`; Chromium at `/opt/pw-browsers/chromium` in the dev container via `CHROMIUM_PATH`) |

Versions are pinned deliberately: TypeScript 7 and Prisma 8 were too new/pre-release at setup time.
| Game Catalog | Ported into the Next.js app + PostgreSQL (option C, approved). Lossless importer from the original SQLite DB via Node 22 `node:sqlite`; QR via `qrcode` |

Do not add dependencies beyond this list without a stated reason.

## 4. Folder structure (planned)

```
/                       Next.js app root
├─ CLAUDE.md
├─ docs/                ROADMAP, ARCHITECTURE, GAME_CATALOG_ANALYSIS, PROGRESS
├─ prisma/              schema.prisma, migrations/, seed.ts (dev data clearly marked)
├─ prisma.config.ts     Prisma 7 config (loads .env via process.loadEnvFile)
├─ public/brand/        Official logo files (unmodified): atom-logo.webp (1254px), atom-logo-256.png
├─ services/
│  └─ game-catalog/     Original Python catalog — DO NOT EDIT (reference + local LAN tool)
├─ src/  (see also: src/lib/rich-text, src/features/settings/site-schema.ts)
│  ├─ app/
│  │  ├─ (public)/      Public pages with header + footer (route group, URL has no prefix)
│  │  ├─ (auth)/        login, register, forgot-password, reset-password
│  │  ├─ account/       Profile, orders, addresses (USER+)
│  │  ├─ partner/       Partner dashboard (PARTNER)
│  │  ├─ admin/         Admin panel (ADMIN)
│  │  └─ api/           Route handlers (auth, uploads, webhooks/payment callbacks)
│  ├─ components/
│  │  ├─ ui/            Design-system primitives (shadcn-based)
│  │  ├─ layout/        Header, desktop/mobile nav, footer, container
│  │  ├─ home/          Homepage sections
│  │  └─ <feature>/     Feature components (store/, news/, ...)
│  ├─ content/          Static copy (home.ts) until editable via site settings (Phase 8)
│  ├─ features/         Per-module server logic: actions, queries, zod schemas
│  │  ├─ auth/ store/ orders/ news/ contact/ partners/ subscriptions/ settings/ tournaments/ game-catalog/
│  ├─ lib/              db, auth, rbac, rate-limit, uploads, money, format (fa digits/dates), logger
│  └─ styles/
└─ tests/               unit/ and e2e/
```

## 5. Architecture decisions (summary)

Full rationale in `docs/ARCHITECTURE.md`.

1. **Modular monolith** in Next.js. Each feature owns its schemas, server actions and queries under `src/features/*`.
2. **Authorization on the server, always.** Every server action / route handler calls `requireRole()` / `requirePermission()`. Middleware only does coarse redirects; it is never the only check.
3. **Money is stored as integer Rials (`BigInt`)**, displayed in Toman per site setting. No floats.
4. **Order lines snapshot product title and price**; inventory changes go through `InventoryMovement` inside a transaction.
5. **Payment is a provider interface** (`PaymentProvider`). Default provider is `disabled`; checkout creates the order as `AWAITING_PAYMENT` and shows a clear message.
6. **Subscriptions are modelled but not purchasable** (`SUBSCRIPTION_PURCHASE_ENABLED = false`). Access to gated features goes through one function: `hasEntitlement(userId, "GAMEPAD_TESTER")` (server-side, DB-backed). The PARTNER role is set/unset only by partner review actions.
7. **Game Catalog:** the original app is kept unchanged in `services/game-catalog/` (reference only). A plain reverse proxy is **unsafe** (localhost-only admin check). Its 17 features are ported into `src/features/game-catalog` with the same rules and game IDs; data imported losslessly from `catalog.db`.
8. **Uploads**: validated by magic bytes + size limit, re-encoded images, random file names, stored outside the code tree (local disk now, S3-compatible later).

## 6. Coding conventions

- **Next.js 16 specifics** (read `node_modules/next/dist/docs/` before using an API): request APIs (`cookies`, `headers`, `params`, `searchParams`) are async; `middleware` is now **`proxy.ts`**; Cache Components is on, so data is dynamic by default — use `"use cache"` + `cacheTag` for cacheable reads and `await connection()` for request-time work; no `runtime` segment config.
- Admin forms with transforming Zod schemas: `useForm<z.input<S>, unknown, z.output<S>>` and send `form.getValues()` (raw input) — the server parses again.
- Prisma 7 unique errors: use `uniqueViolationTarget()` (constraint name lives in `meta.driverAdapterError`).
- Client components using `usePathname()` in shared layouts must be wrapped in `<Suspense>` (dynamic routes fail the build otherwise).
- Rich-text editor output must be plain JSON before sending to a Server Action (ProseMirror attrs are null-prototype objects → React sends them as unusable temporary references). `RichTextEditor` already does `JSON.parse(JSON.stringify(...))`.
- Admin forms pre-filled with values wrap inputs in `<fieldset disabled={!useHydrated()}>` so typing during hydration can't be clobbered.
- Request-bound reads (cart, cookies + time checks) start with `await connection()`.
- Any new client component calling `usePathname()` inside a shared layout needs a `<Suspense>` with a static fallback (see `DesktopNavLinks`, `AccountNavLinks`).
- Never edit cached tables (settings, products) directly in SQL on a running site: cached pages won't refresh until the cache tag is invalidated by an admin action.
- **Data reads on public pages:** `src/features/<module>/queries.ts` functions use `"use cache"` + `cacheLife` + `cacheTag(CACHE_TAGS.x)`. Components that call them start with `await connection()` and are wrapped in `<Suspense>` with a skeleton. Result: static shell, no DB needed at build time, and admin mutations refresh via `updateTag`/`revalidateTag` with the same tag (`src/lib/cache-tags.ts`).
- Values crossing into client components must be serializable: pass money as string (bigint → `.toString()`).
- Under Cache Components `dynamicParams` is unavailable; unknown dynamic params render the 404 UI with HTTP 200 (+ noindex). Use a `proxy.ts` check if a real 404 status is needed.
- shadcn's online registry is blocked in the dev environment, so UI components are written by hand in shadcn style under `src/components/ui` (same structure, `radix-ui` package).
- Text colors: never white on atomic green. Use black on green (`bg-primary`), `text-link` (deep green `#00703C`) for links. Enforced by `tests/unit/brand-contrast.test.ts`.
- Mark LTR snippets (emails, phones, codes, URLs) with the `ltr` class or `dir="ltr"`.
- Scripts: `pnpm check` (typecheck + lint + tests), `pnpm build`, `pnpm db:migrate`, `pnpm maintenance`, `pnpm test:e2e`.
- Iranian servers can't reach binaries.prisma.sh: `scripts/prisma-generate.mjs` (postinstall/build) and `scripts/migrate.mjs` (`pnpm db:deploy`, direct-SQL fallback recorded in `_prisma_migrations`) work without Prisma's engine download.
- CSP: no external origins. A new third-party script/style/frame/form target (e.g. a payment gateway that needs a browser POST) must be added to `csp` in `next.config.ts` deliberately.

- TypeScript strict, no `any` without a comment explaining why.
- Server-only modules import `server-only`. Secrets only via `process.env`, validated at startup by a Zod env schema. Never `NEXT_PUBLIC_` for secrets.
- All input validated with Zod on the server, even if the form already validated it.
- UI text in Persian; code identifiers, comments and commit messages in English.
- RTL: use logical Tailwind utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), never `ml-*`/`mr-*` for layout.
- Display numbers/dates with Persian digits and the Jalali calendar via `Intl` (`fa-IR-u-ca-persian`); store UTC.
- Brand colors only through design tokens (see `docs/ARCHITECTURE.md` §Design system).
- Components: small, typed props, loading / empty / error states required for every data view.
- Dev/sample data must be clearly labelled (`[DEV]` prefix or `isSample` flag) and live only in `prisma/seed.ts`.

## 7. Completed features

- Phase 12: security review (every Server Action/route handler checked for auth + ownership; no secrets in git history; `pnpm audit` clean), CSP + COOP headers (`next.config.ts`; media route keeps its sandbox CSP), `robots.txt`, `sitemap.xml` (products + news, per request), metadataBase/OpenGraph, `pnpm maintenance` (sessions, codes, rate limits, guest carts, unpaid orders, ended subscriptions, `--media` prunes unused/stray uploads > 24 h incl. rich-text references), `scripts/backup.sh` (verified restore), `pnpm test:e2e` smoke test, full `docs/DEPLOYMENT.md` (systemd bound to 127.0.0.1, nginx, cron, restore, updates, go-live checklist).
- Phase 11 + grants: `/tournaments/gamepad-tester` access panel via `getGamepadAccess()` (`src/features/gamepad-tester/access.ts`, `GAMEPAD_TESTER_ENABLED = false`), `src/features/tournaments` placeholder (`TOURNAMENTS_ENABLED = false`), `/admin/tournaments` placeholder; manual grants/cancel in `src/features/subscriptions/admin-actions.ts` (renewals queue via `nextGrantStart`, phases via `subscriptionPhase`).
- Phase 10: partners (`src/features/partners`): public `/partners`, applicant/partner area `/partner` (apply → pending → rejected/resubmit → approved dashboard; suspended), admin `/admin/partners` (review with reasons; PARTNER role mirrors APPROVED, changed only there), admin `/admin/subscriptions` (plans; purchase disabled via `SUBSCRIPTION_PURCHASE_ENABLED = false`, `isActive` never set), `hasEntitlement()` in `src/features/subscriptions/entitlements.ts` — the only gate for partner features.
- Phase 9: Game Catalog module (`src/features/game-catalog`): importer (UI + `pnpm catalog:import`), public `/game-catalog` + `/game-catalog/ps4|ps5` (search, chips, grouped grid, lightbox with keys/swipe, 30 s live refresh via `/api/catalog/version`), admin `/admin/game-catalog` (tabs, bulk upload, edit/replace/move/delete, rename flag, categories with merge/reorder, QR, ZIP export, `.db` restore via `POST /api/admin/catalog/import` with ADMIN + same-origin check). Restoring a `.db` **replaces** the whole catalog.
- Phase 8: site settings groups (home, contact & social, general/footer, tournaments) defined once in `site-schema.ts` → admin tabbed forms + validation + defaults; homepage, footer, meta description and tournament pages read them; editable About page (rich text); news categories + posts (rich-text editor with image upload, cover, draft/publish, featured, public list with featured/category filter/pagination, article page with NewsArticle JSON-LD, related news); contact page + form (honeypot, min-time check, rate limits, hashed IP) and admin inbox (auto-read, archive, delete); dashboard cards for unread messages and drafts.
- Phase 7b: shipping methods (`ShippingMethod` model, migration `shipping_methods`, admin CRUD with validation, checkout selection with live summary, server-side active check, order snapshot, tracking code on SHIPPED with carrier link). The earlier flat shipping setting was removed.
- Phase 7: DB carts for guests (hashed cookie token) and users, merged on login; cart page with live prices and availability issues; checkout (login required) with saved addresses (31 provinces, 10-digit postal code); `placeOrder` re-validates products, row-locks them (`FOR UPDATE`), reserves stock, snapshots prices/address, 20-min payment window; `PaymentProvider` interface + dev-only `sandbox` gateway (refused in production); callback route verifies server-to-server, idempotent, handles late payments (re-reserve or flag refund); failed/expired payments cancel and restore stock; customer order history/detail with retry/cancel; admin orders list/detail with allowed status transitions, notes and payments; admin sales settings (open/close sales, shipping, inquiry phone); dashboard order stats; category «استعلام قیمت».
- Phase 6: image uploads (Server Action, one image per request, decoded + re-encoded to WebP by `sharp`, max 5 MB / 40 MP, random keys, served by `/media/[...key]` with traversal checks, nosniff, sandbox CSP, immutable cache), admin categories (2-level tree, cycle check, delete only when empty), admin products (create/edit/delete-or-archive, Persian slugs, SKU, Toman prices with discount validation, featured flag, ordered images with alt text, status), inventory adjustments with history (atomic, never negative), public `/shop` (search incl. Persian normalization, category filter incl. sub-categories, sort, in-stock filter, pagination) and `/shop/[slug]` (gallery, discount, stock note, plain-text description, related products, Product JSON-LD in IRR).
- Phase 5: registration (mobile or email, verified by 6-digit code), login with password or one-time code, logout, password recovery by SMS/email code, profile (name, change mobile/email with verification), change password, active sessions list with revoke / log out other devices, DB sessions (`Session` table, hashed tokens, httpOnly SameSite=Lax cookie, `__Host-` prefix on HTTPS), DAL (`src/lib/auth/dal.ts`), optimistic `proxy.ts`, PostgreSQL rate limiting, audit log, SMS.ir sender, admin panel shell + dashboard + users management (search/filter/paginate, change role, activate/deactivate, revoke sessions; self and last-admin protection), `pnpm admin:create` CLI.
- Phase 4: public layout (sticky header, desktop nav with active state, RTL slide-in mobile menu, footer, skip link), homepage sections (hero with atom orbits, featured products, catalog stats per platform, tournament band, partner services, latest news, about) reading real DB data with empty states; `/tournaments` placeholder with the required text; interim pages for /shop, /news, /about, /contact, /partners, /game-catalog(/ps4|/ps5), /tournaments/gamepad-tester.
- Phase 3: project setup, design tokens, Vazirmatn, UI primitives (Button, Card, Input, Textarea, NativeSelect, Label, Badge, Separator, Skeleton, Spinner, Dialog, ConfirmDialog, Table, Alert, Empty/Error/Loading states, Toaster, Form), env validation, Prisma client, full DB schema + migration, `/api/health`, security headers, 404/error pages, `/design-system` (dev only).

## 8. Pending features

See `docs/ROADMAP.md` (Phases 3–12).

## 9. Important restrictions

- Do **not** rewrite or delete the existing Game Catalog or its data without explicit approval. Never edit files in `services/game-catalog/`. Never write to an imported `catalog.db`; open it read-only.
- Never create default admin accounts or passwords; use `pnpm admin:create`.
- Authorization: every admin page/action calls `requireRole`/`assertRole` itself — the admin layout and `proxy.ts` are not security boundaries.
- Do **not** reverse-proxy the original catalog to the public internet (its admin is protected only by a localhost check).
- Do **not** modify the ATOM GAME CLUB logo.
- Do **not** enable real payments or paid subscriptions until the owner supplies provider details.
- Do **not** implement tournament generation, brackets or results.
- Do **not** implement Gamepad Tester functionality until detailed specs arrive.
- Do **not** claim a feature works unless it was verified (tests, typecheck, lint, route check).
- No mock functionality in place of real implementation; sample data only when marked as dev data.
- Work phase by phase; before each phase list scope, affected files, dependencies, risks; after it run tests/typecheck/lint and update `docs/PROGRESS.md`.
