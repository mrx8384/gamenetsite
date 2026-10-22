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
- Phase 3 (project init + design system): **done**. Next: Phase 4 (homepage + public layout).

### Owner decisions (2026-10-22)
- Game Catalog: **option C approved** (port into Next.js + PostgreSQL). Catalog admin must require login with password (ADMIN role).
- The original Python app will **not** be used after launch → no sync needed.
- Catalog export: ZIP (`catalog.json` + images) + import from the original `.db`. No `.db` export.
- Prices displayed in **Toman** (stored as Rial).
- Login and password recovery via **both email and SMS**.
- Hosting: **Iranian host** → no external CDNs/fonts at runtime, Iranian SMS + payment providers.

Detailed log: `docs/PROGRESS.md`. Plan: `docs/ROADMAP.md`.

## 3. Technology stack (proposed, pending approval)

| Area | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack, **Cache Components on**), React 19.3, TypeScript 5.9 (strict) |
| Styling | Tailwind CSS 4.3, shadcn/ui pattern on `radix-ui` 1.8 (RTL via `Direction.Provider`), Lucide icons, Vazirmatn variable font (self-hosted in `src/app/fonts`) |
| Data | PostgreSQL 16, Prisma 7.10 (`prisma-client` generator → `src/generated/prisma`, `@prisma/adapter-pg`, config in `prisma.config.ts`) |
| Auth | Auth.js (decided in Phase 5), argon2id hashing |
| Validation / forms | Zod 4, React Hook Form 7 + `@hookform/resolvers` |
| Toasts | sonner |
| Rich text | Tiptap (Phase 8; stores JSON + sanitized HTML) |
| Tests | Vitest 4 (unit, `tests/unit`), Playwright (e2e, Phase 12; Chromium at `/opt/pw-browsers/chromium`) |

Versions are pinned deliberately: TypeScript 7 and Prisma 8 were too new/pre-release at setup time.
| Game Catalog | Recommended: port into the Next.js app + PostgreSQL with a lossless importer from the original SQLite DB (Node 22 built-in `node:sqlite`). **Pending owner approval** |

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
├─ src/
│  ├─ app/
│  │  ├─ (public)/      Home, shop, news, about, contact, game-catalog shell, tournaments
│  │  ├─ (auth)/        login, register, forgot-password, reset-password
│  │  ├─ account/       Profile, orders, addresses (USER+)
│  │  ├─ partner/       Partner dashboard (PARTNER)
│  │  ├─ admin/         Admin panel (ADMIN)
│  │  └─ api/           Route handlers (auth, uploads, webhooks/payment callbacks)
│  ├─ components/
│  │  ├─ ui/            Design-system primitives (shadcn-based)
│  │  └─ <feature>/     Feature components
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
6. **Subscriptions are modelled but not purchasable.** Access to gated features goes through one function: `hasEntitlement(user, "GAMEPAD_TESTER")`.
7. **Game Catalog:** the original app is kept unchanged in `services/game-catalog/`. A plain reverse proxy is **unsafe**: the original admin trusts any request from 127.0.0.1, so behind a proxy everyone would be admin. Recommended (pending approval): port its 17 features into a `game-catalog` module, keep its data model, rules and game IDs, and import data losslessly from `catalog.db`.
8. **Uploads**: validated by magic bytes + size limit, re-encoded images, random file names, stored outside the code tree (local disk now, S3-compatible later).

## 6. Coding conventions

- **Next.js 16 specifics** (read `node_modules/next/dist/docs/` before using an API): request APIs (`cookies`, `headers`, `params`, `searchParams`) are async; `middleware` is now **`proxy.ts`**; Cache Components is on, so data is dynamic by default — use `"use cache"` + `cacheTag` for cacheable reads and `await connection()` for request-time work; no `runtime` segment config.
- shadcn's online registry is blocked in the dev environment, so UI components are written by hand in shadcn style under `src/components/ui` (same structure, `radix-ui` package).
- Text colors: never white on atomic green. Use black on green (`bg-primary`), `text-link` (deep green `#00703C`) for links. Enforced by `tests/unit/brand-contrast.test.ts`.
- Mark LTR snippets (emails, phones, codes, URLs) with the `ltr` class or `dir="ltr"`.
- Scripts: `pnpm check` (typecheck + lint + tests), `pnpm build`, `pnpm db:migrate`.

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

- Phase 3: project setup, design tokens, Vazirmatn, UI primitives (Button, Card, Input, Textarea, NativeSelect, Label, Badge, Separator, Skeleton, Spinner, Dialog, ConfirmDialog, Table, Alert, Empty/Error/Loading states, Toaster, Form), env validation, Prisma client, full DB schema + migration, `/api/health`, security headers, 404/error pages, `/design-system` (dev only).

## 8. Pending features

See `docs/ROADMAP.md` (Phases 3–12).

## 9. Important restrictions

- Do **not** rewrite or delete the existing Game Catalog or its data without explicit approval. Never edit files in `services/game-catalog/`. Never write to an imported `catalog.db`; open it read-only.
- Do **not** reverse-proxy the original catalog to the public internet (its admin is protected only by a localhost check).
- Do **not** modify the ATOM GAME CLUB logo.
- Do **not** enable real payments or paid subscriptions until the owner supplies provider details.
- Do **not** implement tournament generation, brackets or results.
- Do **not** implement Gamepad Tester functionality until detailed specs arrive.
- Do **not** claim a feature works unless it was verified (tests, typecheck, lint, route check).
- No mock functionality in place of real implementation; sample data only when marked as dev data.
- Work phase by phase; before each phase list scope, affected files, dependencies, risks; after it run tests/typecheck/lint and update `docs/PROGRESS.md`.
