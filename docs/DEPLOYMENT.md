# Deployment Notes (draft — completed in Phase 12)

Target: Iranian VPS, Node.js ≥ 22.12, PostgreSQL 16, nginx in front.

## 1. Environment (`.env` on the server, never in Git)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` — changing it invalidates pending one-time codes |
| `APP_URL` | Public HTTPS URL, e.g. `https://example.ir` (enables `__Host-` secure cookies) |
| `UPLOAD_DIR` | Absolute path outside the app directory, e.g. `/var/lib/atom/uploads` |
| `SMS_PROVIDER` | `smsir` in production |
| `SMS_API_KEY` | SMS.ir API key (regenerate the one shared in chat) |
| `SMS_TEMPLATE_ID` | `490537` (SMS.ir verify template with `#CODE#`) |
| `SMS_TEMPLATE_PARAM` | `CODE` |
| `MAIL_PROVIDER` | `log` until an SMTP mailbox exists |
| `PAYMENT_PROVIDER` | `disabled` until the real gateway is implemented. **Never `sandbox` in production** (the app refuses to start) |

## 2. First run

```bash
pnpm install --frozen-lockfile
pnpm db:deploy          # apply migrations
pnpm build
pnpm admin:create       # create the first admin (no default password exists)
pnpm start              # behind nginx, e.g. with systemd or pm2
```

## 3. nginx essentials

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;              # used for rate limiting
    proxy_set_header X-Forwarded-For $remote_addr;        # overwrite, don't append client values
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 8m;                               # image uploads (≤ 5 MB each)
}
```

## 4. Backups

Back up **both**: the PostgreSQL database (`pg_dump`) and the `UPLOAD_DIR` folder (product/news/catalog images).

## 5. Periodic cleanup (cron, daily)

Expired sessions, codes and rate-limit buckets can be purged; a maintenance script is added in Phase 12.
