# Roadmap — ATOM GAME CLUB

Each phase: plan (scope, files, dependencies, risks) → owner approval when it affects business logic → implement → test/typecheck/lint/route check → update `docs/PROGRESS.md` and `CLAUDE.md`.

| # | Phase | Main deliverables | Status |
|---|---|---|---|
| 1 | Inspect & analyse Game Catalog | `docs/GAME_CATALOG_ANALYSIS.md`, baseline run of the catalog | **Done** |
| 2 | Architecture & schema | `docs/ARCHITECTURE.md`, Prisma schema + first migration | **Done** (approved) |
| 3 | Project init & design system | Next.js + TS + Tailwind + shadcn-style (RTL), Vazirmatn, tokens, primitives, env validation, Prisma connected, lint/test setup | **Done** |
| 4 | Homepage & public layout | Header, footer, mobile nav, hero, shop highlights, catalog preview, tournament intro, partners intro, latest news, about | **Done** |
| 5 | Auth & authorization | Register, login, logout, password reset, profile, session invalidation, RBAC helpers, rate limiting, admin route protection | **Done** |
| 6 | Store & product management | Categories, products, images/uploads, search/filter, product pages, admin CRUD, inventory | **Done** |
| 7 | Cart, checkout, orders | Cart (guest + user), checkout with addresses, order creation with stock reservation, order history, admin order management, payment provider interface (disabled) | **Done** (sales closed until a gateway is connected) |
| 8 | News & contact | News CRUD with Tiptap, drafts/published, categories, cover images; About page editor; contact form + admin inbox; site settings — **incl. editing all site texts** (homepage, footer, about, contact, tournament page) | **Done** |
| 9 | Game Catalog integration | Option C: ported module, lossless `catalog.db` importer (UI + CLI), `/game-catalog`, `/admin/game-catalog`, ZIP export | **Done** |
| 10 | Partners | Partner application, admin approve/reject, partner dashboard, subscription status UI, plans (inactive) | Not started |
| 11 | Tournament & Gamepad Tester placeholders | `/tournaments` («بخش تورنومنت به‌زودی فعال می‌شود.»), `/tournaments/gamepad-tester` with entitlement boundary, module skeleton | Not started |
| 12 | QA & hardening | Unit + e2e tests for critical flows, security review, headers/CSP, accessibility, responsive pass, performance, deployment docs | Not started |

## Admin panel modules (built across phases)

Dashboard overview (P7+), Products & Categories (P6), Orders (P7), Users (P5), Partners & Subscriptions (P10), News (P8), Contact messages (P8), Site settings (P8), Game Catalog (P9), Tournament placeholder (P11).

## Decisions made (2026-10-22)

- Game Catalog option C approved; catalog admin behind ADMIN login. `catalog.db` received (85 games, 7 categories).
- Toman display · Email **and** SMS for login/recovery · Iranian hosting · Original Python app retired after launch · ZIP export.

## Open decisions for the owner

1. ~~Git repository~~ → `mrx8384/gamenetsite` ✓
2. SMS.ir: create a **verify template** in the SMS.ir panel containing `#CODE#` (e.g. «کد تأیید آتم گیم کلاب: #CODE#») and send its **template ID**. Then set `SMS_PROVIDER=smsir` and `SMS_TEMPLATE_ID` on the server. Recommended: regenerate the API key (it was shared in chat) and enter the new one directly in the server's `.env`.
3. Email: site domain + an SMTP mailbox from the host (e.g. `no-reply@<domain>`).
4. **Payment gateway** credentials and provider name (owner will send) → implement provider, then the owner opens sales from Admin → تنظیمات فروش.
6. Fill Admin → تنظیمات سایت: contact info, social links, homepage texts and the About page.
5. Add the real shipping companies in Admin → روش‌های ارسال (پس‌کرایه or fixed price) and the «استعلام قیمت» phone in Admin → تنظیمات فروش. At least one active shipping method is required for checkout.

Interim pages (replace when their phase ships): /partners (P10), /tournaments/gamepad-tester (P11).
