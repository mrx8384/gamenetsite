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
| Passwords | argon2id (`@node-rs/argon2`), min length 8, breached-pattern checks kept simple |
| Sessions | Auth.js JWT in httpOnly, Secure, SameSite=Lax cookie. `User.sessionVersion` is embedded in the token and checked server-side so logout-all, password change and role change invalidate old sessions |
| CSRF | Server Actions have built-in origin checks; Auth.js has CSRF tokens; custom route handlers check `Origin` header |
| Authorization | Central `rbac.ts`: `requireRole`, `requireOwnership`, `hasEntitlement`. Middleware only redirects; real checks in every action/handler |
| Rate limiting | PostgreSQL-backed fixed-window counter (no extra infrastructure). Can switch to Redis later behind the same interface |
| Input | Zod everywhere; rich text sanitized on save (allow-list) |
| Uploads | Size limit, MIME by magic bytes, image re-encode (`sharp`), random names, served with correct `Content-Type`, no SVG uploads |
| Secrets | `.env` (git-ignored), validated by Zod env schema at boot; `.env.example` with names only |
| Headers | CSP, HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors |
| Password reset | Random token, only SHA-256 hash stored, 30-minute expiry, single use, same response whether or not the email exists |

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
- **PartnerSubscription**: `partnerId`, `planId`, `status` (`INACTIVE | ACTIVE | EXPIRED | CANCELLED`), `startsAt?`, `endsAt?`, `paymentId?`. Admin can see/edit; no purchase flow yet

### Tournaments (future — no tables created yet)

Reserved module `src/features/tournaments/` with types only. Planned entities: `Tournament`, `TournamentEntry`, `Match`, `Platform/Game` (FIFA / EA SPORTS FC). Created only when specs arrive.

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
hasEntitlement(user, "GAMEPAD_TESTER")
  = user.role === "PARTNER"
    && partner.status === "APPROVED"
    && activeSubscription(partner).plan.features.includes("GAMEPAD_TESTER")
```

`/tournaments/gamepad-tester` renders the placeholder for everyone; the (disabled) tool area is behind this check on the server.

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

- `PaymentProvider` interface: `createPayment(order) → redirectUrl`, `verify(callback) → result`. Implementations added when the owner chooses a provider (e.g. Zarinpal, IDPay, Pay.ir). Enabled only via env + admin setting.
- `Mailer` and `SmsSender` interfaces for login codes, password reset and notifications. In development both write to the server log (`MAIL_PROVIDER=log`, `SMS_PROVIDER=log`). Production: SMTP + an Iranian SMS provider (Kavenegar / SMS.ir), chosen by the owner.
- Login and password recovery work with **email or mobile number** (owner decision). Codes are stored only as hashes in `VerificationCode`, with expiry and attempt limits.

## 6b. Iranian hosting constraints

- No runtime dependency on foreign CDNs: fonts, icons and scripts are bundled/self-hosted.
- Payment and SMS providers must be Iranian services.
- `/api/health` is available for the host's uptime monitoring.

## 7. Deployment (to be confirmed)

- Node 22 runtime for Next.js, PostgreSQL 16. (With option C no Python runtime is needed in production; the original app stays in `services/game-catalog/` for local LAN use.)
- Docker Compose with two services (`web`, `db`) is the suggested baseline. Final setup depends on the Iranian host (VPS vs managed Node hosting).
