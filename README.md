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

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` / `pnpm start` | Production build / server |
| `pnpm check` | Typecheck + lint + unit tests |
| `pnpm db:migrate` | Create & apply migrations (dev) |
| `pnpm db:deploy` | Apply migrations (production) |

Development-only design reference: `/design-system`. Health check: `/api/health`.
