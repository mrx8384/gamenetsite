# ATOM GAME CLUB

Persian-first (RTL) gaming platform: store, news, game catalog, partners, tournaments.
Project memory and conventions: [`CLAUDE.md`](CLAUDE.md) · Docs: [`docs/`](docs/)

## Requirements

- Node.js ≥ 22.12, pnpm 10
- PostgreSQL 16

## Setup

```bash
pnpm install                 # also generates the Prisma client
cp .env.example .env         # fill in DATABASE_URL and AUTH_SECRET
pnpm db:migrate              # create/upgrade the database schema
pnpm dev                     # http://localhost:3000
```

## Run on a local computer (Windows / macOS / Linux)

1. Install **Node.js 22 LTS** (nodejs.org) and **PostgreSQL 16** (remember the password you choose for the `postgres` user).
2. Get the code (download ZIP from GitHub or `git clone`), open a terminal in the folder:

```bash
corepack enable          # once, provides pnpm
pnpm install
pnpm setup:local         # asks for the PostgreSQL password, creates DB + .env, builds, creates the admin, imports catalog.db
```

3. Start: `pnpm start -H 0.0.0.0 -p 3000` (Windows: double-click `start-atom.bat`) → http://localhost:3000.
   Other devices on the same network: `http://<this-PC-IP>:3000` (set that as the site address during setup so catalog QR codes work).

Notes: one-time codes are printed in the server window (`SMS_PROVIDER=log`); log in with password. If Prisma's engine download is blocked, `setup:local` applies the SQL migrations directly (Prisma-compatible).

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm check` | Typecheck + lint + unit tests |
| `pnpm db:migrate` | Create & apply migrations (dev) |
| `pnpm db:deploy` | Apply migrations (production) |
| `pnpm admin:create` | Create an admin account (no default admin exists) |
| `pnpm catalog:import <file.db>` | Import the original game catalog (replaces the catalog) |
| `pnpm maintenance [--media] [--dry-run]` | Daily cleanup (run from cron) |
| `./scripts/backup.sh` | Database + uploads backup with retention |
| `BASE_URL=… pnpm test:e2e` | Read-only smoke test against a running site |
| `pnpm setup:local` | One-time local setup (see above) |

Development-only design reference: `/design-system`. Health check: `/api/health`.

Production setup (systemd, nginx, cron, backups, updates): [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
