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
| `ATOM_WORLD_ADMIN_PASSWORD` | Optional. Password of the 3D world editor (`/atom-world/admin`), at least 10 characters. Set it with `sudo bash scripts/set-world-password.sh` (restarts the site). Site ADMIN accounts work without it. |
| `ATOM_WORLD_DATA_DIR` | Optional. Folder of the 3D world editor (layout, texts, photos). Default: `atom-world` beside `UPLOAD_DIR` (`/srv/atom/atom-world`), created on the first save; backed up by `scripts/backup.sh`. See `docs/ATOM_WORLD.md`. |
| `SMS_PROVIDER` | `smsir` |
| `SMS_API_KEY` | SMS.ir key. **Regenerate the key that was shared in chat** and put only the new one here. |
| `SMS_TEMPLATE_ID` / `SMS_TEMPLATE_PARAM` | `490537` / `CODE` |
| `SMS_SUPPORT_STAFF_TEMPLATE_ID` | Optional. SMS.ir verify template with `#NAME#`, e.g. «پیام جدید پشتیبانی اتم از #NAME#». Sent to the number in Admin → تنظیمات سایت → پشتیبانی آنلاین (max once per conversation per 15 min). Unset → no SMS. |
| `SMS_SUPPORT_REPLY_TEMPLATE_ID` | Optional. Template with `#NAME#`, e.g. «#NAME# عزیز، پشتیبانی اتم گیم کلاب به پیام شما پاسخ داد.» Sent to customers who are not on the site when staff replies (users without a mobile get an email instead). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional «ادامه با گوگل». Google Cloud Console → APIs & Services → OAuth consent screen (External, app name, support email, scopes `openid email profile`, publish) → Credentials → OAuth client ID → Web application; Authorized JavaScript origin `https://www.atomgclub.ir`, Authorized redirect URI `https://www.atomgclub.ir/api/auth/google/callback`. Put both values in `.env`, `systemctl restart atom` (no rebuild needed). The server must reach `oauth2.googleapis.com` (checked 2026-10-31: OK). |
| `MAIL_PROVIDER` | `log` until an SMTP mailbox exists, then `smtp` + `SMTP_HOST`, `SMTP_PORT` (465/587), `SMTP_USER`, `SMTP_PASSWORD` (or one `SMTP_URL` with URL-encoded credentials) and optional `MAIL_FROM`. Test from Admin → تنظیمات سایت → پیامک و ایمیل. While `SMS_PROVIDER=log`, codes go by email only (mobile numbers get a clear message; password login still works). |
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

## 5c. Branded 502/503/504 page

`deploy/errors/` (`50x.html`, logo, Vazirmatn) is copied by the installer to `/var/www/atom-errors` on every run and wired in via `/etc/nginx/snippets/atom-errors.conf` (`error_page 502 503 504`, assets under `/__atom_errors/`, `Cache-Control: no-store`). Existing servers get the `include` added automatically (backup in `sites-available/atom.bak`, restored if `nginx -t` fails). The page re-checks the site and reloads itself when it answers again. Limitation: if the whole server is unreachable, ArvanCloud shows its own error page.

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
- [ ] Google Search Console: verify the `https://www.atomgclub.ir` property (DNS TXT in ArvanCloud), submit `/sitemap.xml`, request indexing of the homepage.

## 10. Notes

- **CSP and payment gateways:** `form-action 'self'` blocks HTML forms that post to other domains. If the chosen gateway needs a browser POST to its own domain (most Iranian gateways redirect with GET), add that domain to `form-action` in `next.config.ts` when the provider is implemented.
- Nonce-based CSP is not used because it is incompatible with Partial Prerendering; inline scripts are allowed, everything else is same-origin only.
- The app refuses to start with invalid environment variables or with `PAYMENT_PROVIDER=sandbox` in production.
- **3D world** (`/atom-world`, `docs/ATOM_WORLD.md`): its pages alone allow `'wasm-unsafe-eval'` (WebAssembly decoders) and `blob:` in `connect-src`. Online play between two phones keeps rooms in the app's memory (one app process; a restart ends open rooms). The world editor data folder must stay outside the app directory (default beside `UPLOAD_DIR`).
