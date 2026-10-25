# Architecture — ATOM GAME CLUB

Status: **approved 2026-10-22**. Implemented schema: `prisma/schema.prisma` (differences from this text are noted there).

## 1. High-level shape

```
Browser (fa-IR, RTL)
   │
   ▼
Next.js app (App Router)  ── modular monolith ──────────────────────────┐
   ├─ Public pages (RSC, cached where safe)                              │
   ├─ Account / Partner / Admin areas (dynamic, role-gated)              │
   ├─ Server Actions + Route Handlers  → Zod → RBAC → features/* → Prisma│
   └─ /game-catalog/*  → Game Catalog module (ported, see §3)           │
                                                                          │
PostgreSQL ◄── Prisma ────────────────────────────────────────────────────┘
Uploads storage (local disk now → S3-compatible later)
```

### Request pipeline for every mutation

1. Parse input with Zod (server side).
2. `auth()` → session; `requireRole()` / ownership check.
3. Rate limit for sensitive actions (login, register, password reset, contact form, partner application).
4. Business logic in `src/features/<module>/service.ts`, inside a Prisma transaction where several rows change.
5. Audit log for admin actions.
6. Return typed result `{ ok: true, data } | { ok: false, error }`; UI shows Persian toast.

## 2. Security design

| Concern | Approach |
|---|---|
| Passwords | argon2id (`@node-rs/argon2`, 19 MiB / t=2 / p=1), min 8 chars with a letter and a digit; constant-time dummy check for unknown accounts |
| Sessions | **Database sessions** (decided in Phase 5, replacing the Auth.js proposal): random 256-bit token in an httpOnly, SameSite=Lax cookie (`__Host-atom_session` + Secure on HTTPS); only its SHA-256 hash is stored in `sessions`. 30-day absolute expiry. Revocation = delete rows: logout, "log out other devices", password change/reset, role change and deactivation all revoke sessions immediately |
| One-time codes | 6 digits, HMAC-SHA256(AUTH_SECRET) hash only, 2 min (SMS) / 15 min (email) validity, 5 wrong attempts max, 60 s resend cooldown, single use, older codes invalidated |
| CSRF | Server Actions have built-in origin checks; Auth.js has CSRF tokens; custom route handlers check `Origin` header |
| Authorization | Central `rbac.ts`: `requireRole`, `requireOwnership`, `hasEntitlement`. Middleware only redirects; real checks in every action/handler |
| Rate limiting | PostgreSQL-backed fixed-window counter, atomic upsert (`src/lib/rate-limit.ts`). Login: 30/15 min per IP, 8/15 min per account; codes: 10/h per IP, 5/h per target; registration 10/h per IP; code verification 30/15 min per IP |
| Account enumeration | Login-by-code and password reset answer the same whether the account exists or not; login errors don't say which part was wrong |
| Client IP | `X-Real-IP` / last `X-Forwarded-For` hop — nginx must set these (see deployment notes) |
| Input | Zod everywhere; rich text sanitized on save (allow-list) |
| Uploads | Size limit, MIME by magic bytes, image re-encode (`sharp`), random names, served with correct `Content-Type`, no SVG uploads |
| Secrets | `.env` (git-ignored), validated by Zod env schema at boot; `.env.example` with names only |
| Headers | `next.config.ts`: CSP (same-origin only; `'unsafe-inline'` scripts because nonce CSP is incompatible with Partial Prerendering; `frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`), HSTS + `upgrade-insecure-requests` when `APP_URL` is https, nosniff, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy, COOP. `/media/*` keeps its own `default-src 'none'; sandbox` |
| Operations | `pnpm maintenance` (daily cron), `scripts/backup.sh` (pg_dump + uploads, retention), `pnpm test:e2e` (read-only smoke test), `/api/health`; app binds to 127.0.0.1 behind nginx |
| Password reset | Random token, only SHA-256 hash stored, 30-minute expiry, single use, same response whether or not the email exists |

### Why not Auth.js

Auth.js v5 has never left beta, and its Credentials provider (password / code login) only supports JWT sessions. That rules out listing and revoking individual devices, which session management requires. The custom layer is ~300 lines following the official Next.js authentication guide (Data Access Layer + database sessions), has no extra dependencies and is covered by e2e tests.

## 3. Database schema (draft)

Prisma, PostgreSQL. IDs are `cuid()`. All tables have `createdAt` / `updatedAt` unless noted.
Money columns are `BigInt` Rials.

### Identity & access

- **User**: `email` (unique, lowercased), `phone?` (unique), `name`, `passwordHash`, `role` (`ADMIN | USER | PARTNER`, default `USER`), `isActive`, `emailVerifiedAt?`, `sessionVersion` (int)
- **PasswordResetToken**: `userId`, `tokenHash` (unique), `expiresAt`, `usedAt?`
- **Address**: `userId`, `recipientName`, `phone`, `province`, `city`, `postalCode`, `line`, `isDefault`
- **RateLimitBucket**: `key` (unique), `count`, `windowStart`
- **AuditLog**: `actorId?`, `action`, `entity`, `entityId`, `meta` (Json), `ip?` (no `updatedAt`)

### Store

- **Category**: `name`, `slug` (unique), `parentId?` (self-relation), `sortOrder`, `isActive`
- **Product**: `title`, `slug` (unique), `sku` (unique), `shortDescription`, `description` (rich text), `price`, `compareAtPrice?`, `stock` (int, `CHECK stock >= 0`), `status` (`DRAFT | ACTIVE | ARCHIVED`), `categoryId`, `isFeatured`
- **ProductImage**: `productId`, `mediaId`, `alt`, `sortOrder`
- **InventoryMovement**: `productId`, `delta`, `reason` (`MANUAL | ORDER | CANCEL | RETURN`), `orderId?`, `actorId?`
- **Cart** / **CartItem**: cart by `userId` or signed `guestToken`; `CartItem(cartId, productId)` unique, `quantity > 0`

### Orders & payments

- **Order**: `number` (unique, human-readable), `userId`, `status` (`PENDING | AWAITING_PAYMENT | PAID | PROCESSING | SHIPPED | DELIVERED | CANCELLED | REFUNDED`), `subtotal`, `shippingCost`, `discount`, `total`, shipping snapshot (`recipientName`, `phone`, `province`, `city`, `postalCode`, `addressLine`), `customerNote?`, `adminNote?`
- **OrderItem**: `orderId`, `productId?` (`SetNull` on delete), `titleSnapshot`, `skuSnapshot`, `unitPrice`, `quantity`
- **OrderStatusHistory**: `orderId`, `from`, `to`, `actorId?`, `note?`
- **Payment**: `orderId`, `provider`, `status` (`INITIATED | SUCCEEDED | FAILED | CANCELLED`), `amount`, `authority?`, `referenceId?`, `raw` (Json). Provider default: `disabled`

### Content

- **NewsCategory**: `name`, `slug` (unique)
- **NewsPost**: `title`, `slug` (unique), `excerpt`, `contentJson` (Tiptap), `contentHtml` (sanitized), `coverMediaId?`, `status` (`DRAFT | PUBLISHED`), `publishedAt?`, `authorId`, `categoryId?`
- **Page**: `slug` (unique, e.g. `about`), `title`, `contentJson`, `contentHtml` — editable About page
- **SiteSetting**: `key` (unique), `value` (Json) — contact info, social links, currency display, payment toggle, hero text
- **Media**: `path`, `mimeType`, `size`, `width?`, `height?`, `uploaderId`
- **ContactMessage**: `name`, `email`, `phone?`, `subject`, `body`, `status` (`NEW | READ | ARCHIVED`), `ipHash?`

### Partners & subscriptions

- **PartnerProfile**: `userId` (unique), `businessName`, `businessType` (e.g. `GAME_NET | SHOP | OTHER`), `province`, `city`, `address`, `phone`, `website?`, `description`, `status` (`PENDING | APPROVED | REJECTED | SUSPENDED`), `reviewedById?`, `reviewedAt?`, `rejectionReason?`. Approval sets `User.role = PARTNER` in the same transaction
- **SubscriptionPlan**: `code` (unique), `name`, `price`, `durationDays`, `features` (Json array of entitlement keys, e.g. `["GAMEPAD_TESTER"]`), `isActive` (default **false**)
- **PartnerSubscription**: `partnerId`, `planId`, `status` (`INACTIVE | ACTIVE | EXPIRED | CANCELLED`), `startsAt?`, `endsAt?`, `paymentId?`. No purchase flow; admins can grant free subscriptions to APPROVED partners (renewals start when the current period ends) and cancel them
- `PartnerProfile.submittedAt` orders the review queue; `SubscriptionPlan.isVisible` shows a plan as «به‌زودی» on public/partner pages

### Tournaments (owner request 2026-10-23)

- **Tournament**: slug (Persian, `RESERVED_SLUGS` excluded), name, game, platform, description, rules, prize, entry-fee note, `startsAt` (entered in Tehran time, stored UTC), `format` (`SINGLE_ELIMINATION | DOUBLE_ELIMINATION | ROUND_ROBIN | GROUPS_KNOCKOUT`), `status` (`DRAFT → REGISTRATION → IN_PROGRESS → COMPLETED`, or `CANCELLED`), capacity, self-registration flag, third-place match, double round robin, group count / advance per group, points (win/draw/loss), `organizerId` (admin or partner), `knockoutStarted`.
- **TournamentParticipant**: optional `userId` (online sign-up) or manual name; `seed` (list order = seeding), `groupIndex`, `finalRank`. Unique per tournament on user and on name.
- **TournamentMatch**: stage (`WINNERS/LOSERS/GRAND_FINAL/GRAND_FINAL_RESET/THIRD_PLACE/ROUND_ROBIN/GROUP`), round, position, group, display number, players + bye flags, scores, winner, status (`PENDING/COMPLETED/SKIPPED`), links `nextMatchId/nextSlot` and `loserMatchId/loserSlot`.

Flow: `engine.ts` generates pure match specs (standard seeding, byes for top seeds, double-elimination losers bracket with reversed drops, circle-method round robin, snake groups, knockout seeding that keeps group mates apart). `service.ts` locks the tournament row (`FOR UPDATE`) for every change, maps DB rows to the engine's live map, applies `applyResult`/`clearResult` (re-reporting allowed until a downstream match is played; GF won by the losers-bracket player activates the reset) and writes back only the changed matches. Ranks are computed when every match is done (and cleared when a result is removed). Organizers: `canCreateTournament` (admin, or partner with `TOURNAMENT_HOST`) and `canManageTournament` (admin, or the organizing partner).

### Online support (owner request 2026-10-25)

- Role `SUPPORT`: the admin layout admits ADMIN + SUPPORT, but every other admin page/action still requires ADMIN; SUPPORT sees only `/admin/support` (and `/admin` redirects there).
- **SupportConversation** (one per user, `OPEN`/`CLOSED`; a new user message reopens it): `unreadByStaff` / `unreadByUser` counters, `userLastSeenAt` (updated by widget polling), `staffNotifiedAt` / `customerNotifiedAt` (15-min throttles claimed atomically with `updateMany`). **SupportMessage**: body ≤ 2000 chars (plain text, rendered escaped), `fromStaff`, `senderId` (SetNull).
- Transport: HTTP polling (no websockets; works behind nginx and ArvanCloud): `GET /api/support` (customer; 4 s open / 25 s closed, paused while the tab is hidden), `GET /api/admin/support/unread` (15 s, badge + Web Audio chime), `GET /api/admin/support/[id]` (4 s, marks read). Cursor = last `createdAt` (inclusive, client de-duplicates by id). All responses `Cache-Control: private, no-store`.
- Sending via Server Actions (`src/features/support/actions.ts`), rate limited (customer 8/min + 200/day). Notifications run in `after()` so they never block or fail the action.

### Support FAQ suggestions (2026-10-25)

`SupportFaq` rows are cached (`faq` tag) and sent to the widget; `faq-match.ts` scores them in the browser (normalization, stop words, light stemming, question/keyword ×3 + answer, threshold 0.8 per query token). Counters `openCount`/`helpfulCount` via a rate-limited public action. Admin + SUPPORT manage them at `/admin/support/faq`.

### Game Catalog (option C — pending approval)

Mirrors the original SQLite model (see `docs/GAME_CATALOG_ANALYSIS.md`).

- enum **CatalogPlatform**: `PS4 | PS5`
- **CatalogCategory**: `id` (int), `platform`, `name` (≤40), `position`, `isDefault` (the locked «بدون دسته»), `UNIQUE(platform, name)`
- **CatalogGame**: `id` (string, keeps the original 12-hex IDs), `name` (≤80), `platform`, `categoryId`, `imageMediaId` → `Media`, `createdAt`, `updatedAt`, `legacySource?` (which import it came from)
- **CatalogImportRun**: `sourceFileName`, `sourceSha256`, `schemaVersion`, `gamesImported`, `categoriesImported`, `actorId`, `createdAt`. Used for traceability; the source file is kept read-only

Rules kept: default category per platform cannot be renamed or deleted; renaming to an existing name merges; deleting a category moves games to the default; moving platforms keeps the category name.

## 4. Gated features

```ts
// Single source of truth for feature access
hasEntitlement(userId, "GAMEPAD_TESTER")   // src/features/subscriptions/entitlements.ts
  = user.isActive && user.role === "PARTNER"
    && partner.status === "APPROVED"
    && partner.subscriptions.some(s => s.status === "ACTIVE" && s.startsAt <= now < s.endsAt
                                       && s.plan.features.includes("GAMEPAD_TESTER"))
```

`/tournaments/gamepad-tester`: `getGamepadAccess()` explains the visitor's state; entitled partners and admins (`canUseGamepadTester`) get the browser tester.

`TOURNAMENT_HOST` (same function): lets an approved partner create tournaments at `/partner/tournaments`. Admins always can.

## 5. Design system

Tokens (CSS variables → Tailwind theme):

| Token | Value | Use |
|---|---|---|
| `--brand-green` | `#00C96B` | Primary actions, highlights |
| `--brand-green-dark` | `#008F4C` | Hover/active, text on light bg (better contrast) |
| `--brand-cream` | `#FAF9F3` | Page background (light theme default) |
| `--brand-yellow` | `#FFDF00` | Accents, badges — never as text on cream |
| `--brand-black` | `#111111` | Body text, dark surfaces |

- Font: Vazirmatn (self-hosted via `next/font/local`), Persian digits enabled.
- `<html lang="fa" dir="rtl">`; shadcn components audited for RTL (icons that indicate direction are mirrored).
- Primitives: Button, Card, Input, Textarea, Select, Dialog, ConfirmDialog, Table (sort/search/paginate), Form wrappers, Toast, Badge, Skeleton, EmptyState, ErrorState, Pagination, Breadcrumbs.
- Motion: short (150–250 ms) opacity/translate transitions; respects `prefers-reduced-motion`.
- Contrast: white text on `#00C96B` fails WCAG AA for small text → buttons use `#111111` text on green or white text on `#008F4C`. To confirm visually in Phase 3.

## 6. Payment & email integration points

- `PaymentProvider` (`src/features/payments/types.ts`): `createPayment({paymentId, amount, description, callbackUrl, mobile}) → {authority, redirectUrl}` and `verifyPayment({authority, amount, callbackParams}) → ok/refId | fail`. Active provider comes from `PAYMENT_PROVIDER`; `sandbox` is a dev-only test gateway (env validation refuses it in production).
- Order lifecycle: `AWAITING_PAYMENT` (stock reserved, 20-min `paymentDeadline`) → callback verified server-to-server → `PAID` | failed/expired → `CANCELLED` (stock restored, `ORDER_CANCEL` movements). Late payment after expiry: stock re-reserved if available, otherwise the order stays cancelled and is flagged for refund. Admin transitions: PAID→PROCESSING→SHIPPED→DELIVERED, cancel before shipping, REFUNDED marker.
- Online sales switch (`site_settings.commerce.salesEnabled`) can only be turned on when a provider is configured; cart and checkout are closed otherwise.
- `Mailer` and `SmsSender` interfaces for login codes, password reset and notifications. In development both write to the server log (`MAIL_PROVIDER=log`, `SMS_PROVIDER=log`). Production: SMTP + an Iranian SMS provider (Kavenegar / SMS.ir), chosen by the owner.
- Login and password recovery work with **email or mobile number** (owner decision). Codes are stored only as hashes in `VerificationCode`, with expiry and attempt limits.

### Email provider recommendation

- Use an **SMTP mailbox on the site's own domain from the Iranian host** (most Iranian hosting plans include email), e.g. `no-reply@<domain>`, sent via `nodemailer` (added in Phase 5 behind the `Mailer` interface).
- Avoid foreign transactional services (SendGrid, Mailgun, Resend, ...): account approval and delivery from Iran are unreliable because of sanctions.
- Configure SPF, DKIM and DMARC on the domain so emails don't land in spam.
- SMS is the primary channel for Iranian users (login codes, recovery); email is the secondary channel.

## 6b. Iranian hosting constraints

- No runtime dependency on foreign CDNs: fonts, icons and scripts are bundled/self-hosted.
- Payment and SMS providers must be Iranian services.
- `/api/health` is available for the host's uptime monitoring.

## 7. Deployment (to be confirmed)

- Node 22 runtime for Next.js, PostgreSQL 16. (With option C no Python runtime is needed in production; the original app stays in `services/game-catalog/` for local LAN use.)
- Docker Compose with two services (`web`, `db`) is the suggested baseline. Final setup depends on the Iranian host (VPS vs managed Node hosting).
