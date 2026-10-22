# Roadmap — ATOM GAME CLUB

Each phase: plan (scope, files, dependencies, risks) → owner approval when it affects business logic → implement → test/typecheck/lint/route check → update `docs/PROGRESS.md` and `CLAUDE.md`.

| # | Phase | Main deliverables | Status |
|---|---|---|---|
| 1 | Inspect & analyse Game Catalog | `docs/GAME_CATALOG_ANALYSIS.md`, baseline run of the catalog | **Done** |
| 2 | Architecture & schema | `docs/ARCHITECTURE.md`, Prisma schema + first migration | **Done** (approved) |
| 3 | Project init & design system | Next.js + TS + Tailwind + shadcn-style (RTL), Vazirmatn, tokens, primitives, env validation, Prisma connected, lint/test setup | **Done** |
| 4 | Homepage & public layout | Header, footer, mobile nav, hero, shop highlights, catalog preview, tournament intro, partners intro, latest news, about | Not started |
| 5 | Auth & authorization | Register, login, logout, password reset, profile, session invalidation, RBAC helpers, rate limiting, admin route protection | Not started |
| 6 | Store & product management | Categories, products, images/uploads, search/filter, product pages, admin CRUD, inventory | Not started |
| 7 | Cart, checkout, orders | Cart (guest + user), checkout with addresses, order creation with stock reservation, order history, admin order management, payment provider interface (disabled) | Not started |
| 8 | News & contact | News CRUD with Tiptap, drafts/published, categories, cover images; About page editor; contact form + admin inbox; site settings | Not started |
| 9 | Game Catalog integration | Recommended option C: port module, lossless `catalog.db` importer, `/game-catalog`, `/admin/game-catalog`, ZIP (and optional .db) export | Not started |
| 10 | Partners | Partner application, admin approve/reject, partner dashboard, subscription status UI, plans (inactive) | Not started |
| 11 | Tournament & Gamepad Tester placeholders | `/tournaments` («بخش تورنومنت به‌زودی فعال می‌شود.»), `/tournaments/gamepad-tester` with entitlement boundary, module skeleton | Not started |
| 12 | QA & hardening | Unit + e2e tests for critical flows, security review, headers/CSP, accessibility, responsive pass, performance, deployment docs | Not started |

## Admin panel modules (built across phases)

Dashboard overview (P7+), Products & Categories (P6), Orders (P7), Users (P5), Partners & Subscriptions (P10), News (P8), Contact messages (P8), Site settings (P8), Game Catalog (P9), Tournament placeholder (P11).

## Decisions made (2026-10-22)

- Game Catalog option C approved; catalog admin behind ADMIN login. `catalog.db` received (85 games, 7 categories).
- Toman display · Email **and** SMS for login/recovery · Iranian hosting · Original Python app retired after launch · ZIP export.

## Open decisions for the owner

1. **Git repository** for the project (this environment is temporary; work must be pushed to survive).
2. SMS provider (e.g. Kavenegar, SMS.ir) and email/SMTP provider — needed before Phase 5 goes live (development uses log output).
3. Payment gateway (e.g. Zarinpal) — later; not needed to start.
4. Two games in the catalog are named "images" (from bulk upload file names) — rename after import?
