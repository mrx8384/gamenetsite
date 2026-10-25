# Deployment Guide

Target: Iranian VPS (Ubuntu 22.04/24.04), Node.js ≥ 22.12, PostgreSQL 16, nginx in front, systemd.
No external CDN, font or script is used at runtime, so the site works on Iranian hosting without foreign access.

## 1. Environment (`/srv/atom/app/.env`, owner-only, never in Git)

| Variable | Production value / notes |
|---|---|
| `DATABASE_URL` | `postgresql://atom:<password>@127.0.0.1:5432/atom?schema=public` |
| `AUTH_SECRET` | `openssl rand -base64 32` (changing it invalidates pending one-time codes) |
| `APP_URL` | Exact public HTTPS origin, e.g. `https://atomgameclub.ir` — enables `__Host-` secure cookies, HSTS and `upgrade-insecure-requests`, and is checked as `Origin` by the catalog restore route. **Set before `pnpm build`** (security headers are computed at build time). |
| `UPLOAD_DIR` | `/srv/atom/uploads` (outside the app directory) |
| `SMS_PROVIDER` | `smsir` |
| `SMS_API_KEY` | SMS.ir key. **Regenerate the key that was shared in chat** and put only the new one here. |
| `SMS_TEMPLATE_ID` / `SMS_TEMPLATE_PARAM` | `490537` / `CODE` |
| `SMS_SUPPORT_STAFF_TEMPLATE_ID` | Optional. SMS.ir verify template with `#NAME#`, e.g. «پیام جدید پشتیبانی آتم از #NAME#». Sent to the number in Admin → تنظیمات سایت → پشتیبانی آنلاین (max once per conversation per 15 min). Unset → no SMS. |
| `SMS_SUPPORT_REPLY_TEMPLATE_ID` | Optional. Template with `#NAME#`, e.g. «#NAME# عزیز، پشتیبانی آتم گیم کلاب به پیام شما پاسخ داد.» Sent to customers who are not on the site when staff replies (users without a mobile get an email instead). |
| `MAIL_PROVIDER` | `log` until an SMTP mailbox exists, then `smtp` + `SMTP_URL` + `MAIL_FROM` |
| `PAYMENT_PROVIDER` | `disabled` until the real gateway is implemented. `sandbox` is refused in production. |

```bash
chmod 600 /srv/atom/app/.env
```

## 2. Server preparation (once)

```bash
# System user and folders
sudo adduser --system --group --home /srv/atom atom
sudo mkdir -p /srv/atom/uploads /var/backups/atom
sudo chown -R atom:atom /srv/atom /var/backups/atom

# Node 22 + pnpm, PostgreSQL 16, nginx, certbot (use the host's Iranian mirrors if needed)
sudo apt install -y postgresql-16 nginx certbot python3-certbot-nginx
corepack enable && corepack prepare pnpm@10 --activate

# Database
sudo -u postgres createuser --pwprompt atom
sudo -u postgres createdb -O atom atom
```

PostgreSQL must listen on localhost only (default `listen_addresses = 'localhost'`).

## 3. Install and first run

```bash
sudo -iu atom
git clone https://github.com/mrx8384/gamenetsite.git /srv/atom/app && cd /srv/atom/app
cp .env.example .env && nano .env          # fill in §1
pnpm install --frozen-lockfile
pnpm db:deploy                              # apply migrations
pnpm build
pnpm admin:create                           # first admin (there is no default password)
pnpm catalog:import /path/to/catalog.db     # owner's game catalog (replaces the catalog)
```

## 4. systemd service

`/etc/systemd/system/atom.service`:

```ini
[Unit]
Description=ATOM GAME CLUB (Next.js)
After=network.target postgresql.service

[Service]
User=atom
WorkingDirectory=/srv/atom/app
Environment=NODE_ENV=production
# Bind to localhost only: clients must go through nginx (it sets the trusted X-Real-IP).
ExecStart=/usr/bin/env pnpm start -H 127.0.0.1 -p 3000
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/srv/atom

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now atom
curl -s http://127.0.0.1:3000/api/health     # {"status":"ok",...}
```

## 5. nginx

`/etc/nginx/sites-available/atom` (then `ln -s` into `sites-enabled`, `nginx -t`, reload):

```nginx
server {
    listen 80;
    server_name atomgameclub.ir www.atomgameclub.ir;
    return 301 https://atomgameclub.ir$request_uri;
}

server {
    listen 443 ssl http2;
    server_name atomgameclub.ir;
    # ssl_certificate / ssl_certificate_key: managed by certbot (sudo certbot --nginx)

    client_max_body_size 8m;            # one image (≤ 5 MB) per request

    location = /api/admin/catalog/import {
        client_max_body_size 200m;       # catalog.db restore (app limit 200 MB)
        proxy_request_buffering off;
        proxy_read_timeout 300s;
        include /etc/nginx/snippets/atom-proxy.conf;
    }

    location /_next/static/ {
        include /etc/nginx/snippets/atom-proxy.conf;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        include /etc/nginx/snippets/atom-proxy.conf;
    }
}
```

`/etc/nginx/snippets/atom-proxy.conf`:

```nginx
proxy_pass http://127.0.0.1:3000;
proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;           # used for rate limiting and audit logs
proxy_set_header X-Forwarded-For $remote_addr;     # overwrite, never append client-supplied values
proxy_set_header X-Forwarded-Proto $scheme;
```

Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP) are sent by the app itself (`next.config.ts`); don't duplicate them in nginx.

## 5b. HTTPS through ArvanCloud CDN (used for atomgclub.ir)

The domain's DNS is on ArvanCloud. Let's Encrypt cannot validate it (Arvan's nameservers are not visible from abroad), so HTTPS is terminated at Arvan's edge:

1. DNS: A records `@` and `www` → server IP, cloud (proxy) **on**, origin protocol **HTTP** (port 80). With HTTPS/auto the edge tries port 443 and returns 502.
2. HTTPS settings: HTTPS on, Arvan's free managed certificate, "HTTPS by default" (redirect) on. Leave "upgrade insecure requests" off (the app sends it itself when `APP_URL` is https).
3. Real client IPs (required for rate limits and audit logs):
   `{ for ip in $(curl -fsS https://www.arvancloud.ir/fa/ips.txt); do echo "set_real_ip_from $ip;"; done; echo "real_ip_header ar-real-ip;"; } > /etc/nginx/conf.d/arvan-realip.conf && nginx -t && systemctl reload nginx`
   Re-run occasionally (Arvan's ranges change).
4. `APP_URL` in `.env` = the host Arvan finally serves. For atomgclub.ir Arvan redirects the apex to `www`, so `APP_URL="https://www.atomgclub.ir"`. If `APP_URL` is the apex while Arvan redirects to www, `src/proxy.ts` (www → APP_URL) and Arvan redirect in a loop. Check with `curl -sI https://<domain>/ https://www.<domain>/ | grep -i location`. Then run the installer again (rebuild).

## 6. Scheduled jobs (`crontab -e` as `atom`)

```cron
# Daily maintenance: expired sessions/codes/rate limits, unpaid orders past deadline, ended subscriptions, unused uploads
30 3 * * * cd /srv/atom/app && pnpm -s maintenance --media >> /srv/atom/maintenance.log 2>&1
# Nightly backup: database + uploads, keep 14 days
0 4 * * *  cd /srv/atom/app && BACKUP_DIR=/var/backups/atom KEEP_DAYS=14 ./scripts/backup.sh >> /srv/atom/backup.log 2>&1
```

Run `pnpm maintenance --dry-run --media` first to see what would be removed. Copy backups off the server regularly (another host or the owner's storage).

## 7. Backups and restore

`scripts/backup.sh` writes `db-<stamp>.dump` (pg_dump custom format, verified with `pg_restore --list`) and `uploads-<stamp>.tar.gz`, owner-only permissions. Restore (tested 2026-10-22):

```bash
sudo systemctl stop atom
sudo -u postgres dropdb atom && sudo -u postgres createdb -O atom atom
sudo -u postgres pg_restore --no-owner --role=atom -d atom /var/backups/atom/db-<stamp>.dump
sudo -u atom tar -xzf /var/backups/atom/uploads-<stamp>.tar.gz -C /srv/atom   # restores /srv/atom/uploads
sudo systemctl start atom
```

The catalog admin's ZIP export is an extra, portable copy of the game catalog only.

## 8. Updating

```bash
sudo -iu atom && cd /srv/atom/app
./scripts/backup.sh                     # always back up before migrating
git pull origin main
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
exit && sudo systemctl restart atom
```

Rollback: `git checkout <previous commit>`, `pnpm install`, `pnpm build`, restart. If a migration was applied, restore the database backup taken before the update.

## 9. Go-live checklist

- [ ] `APP_URL` is the HTTPS domain and the build was made after setting it (check the `Strict-Transport-Security` response header).
- [ ] `/api/health` returns `ok`; the app listens on 127.0.0.1 only (`ss -ltnp | grep 3000`).
- [ ] New SMS.ir key in `.env`, `SMS_PROVIDER=smsir`; send yourself a login code.
- [ ] First admin created; catalog imported; site texts, contact info and shipping methods filled in the admin panel.
- [ ] Online sales stay **closed** until the gateway is implemented (Admin → تنظیمات سایت → فروش).
- [ ] Cron jobs installed; one backup restored on a test database.
- [ ] `robots.txt` and `sitemap.xml` show the real domain.

## 10. Notes

- **CSP and payment gateways:** `form-action 'self'` blocks HTML forms that post to other domains. If the chosen gateway needs a browser POST to its own domain (most Iranian gateways redirect with GET), add that domain to `form-action` in `next.config.ts` when the provider is implemented.
- Nonce-based CSP is not used because it is incompatible with Partial Prerendering; inline scripts are allowed, everything else is same-origin only.
- The app refuses to start with invalid environment variables or with `PAYMENT_PROVIDER=sandbox` in production.
