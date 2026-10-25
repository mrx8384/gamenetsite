#!/usr/bin/env bash
# ATOM GAME CLUB — one-command server installer / updater for Ubuntu 22.04 / 24.04.
#
# Fresh server (as root, in the provider's web console or over SSH):
#   curl -fsSL https://raw.githubusercontent.com/mrx8384/gamenetsite/main/scripts/install-server.sh -o install.sh && bash install.sh
#
# Run it again at any time to update the site to the latest version (keeps data and settings).
#
# Optional environment variables:
#   DOMAIN=example.ir EMAIL=you@example.com   skip the questions (EMAIL is for the HTTPS certificate)
#   NPM_REGISTRY=https://...                  npm mirror if registry.npmjs.org is unreachable
#   REPO_URL=... BRANCH=main                  source repository
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/mrx8384/gamenetsite.git}"
BRANCH="${BRANCH:-main}"
APP_USER="atom"
BASE="/srv/atom"
APP_DIR="$BASE/app"
UPLOAD_DIR="$BASE/uploads"
BACKUP_DIR="/var/backups/atom"
PORT=3000
NODE_MAJOR=22
NODE_VERSION_FALLBACK="22.22.0"
NO_SYSTEMD="${ATOM_NO_SYSTEMD:-0}"   # testing only (containers without systemd)

say()  { printf '\n\033[1;32m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
# Keep proxy settings (if the server uses one) when running commands as the app user.
KEEP_ENV="HTTP_PROXY,HTTPS_PROXY,NO_PROXY,http_proxy,https_proxy,no_proxy,NODE_EXTRA_CA_CERTS,SSL_CERT_FILE,npm_config_https_proxy,npm_config_noproxy"
as_app() { sudo -u "$APP_USER" -H --preserve-env="$KEEP_ENV" bash -c "cd '$APP_DIR' && $*"; }

[[ $EUID -eq 0 ]] || die "Run as root (e.g. sudo bash install.sh)."

# Only one install/update at a time (two builds at once exhaust the memory of small servers).
exec 9>/var/lock/atom-install.lock
flock -n 9 || die "Another install/update is already running. Wait for it to finish (or close it) and try again."
# Holding our lock means any remaining build is left over from an interrupted run. Its worker
# processes (other names than "next build") can survive and keep Next's build lock (.next/lock).
NEXT_LOCK="$APP_DIR/.next/lock"
if [[ -e "$NEXT_LOCK" ]] && command -v fuser >/dev/null && fuser -s "$NEXT_LOCK" 2>/dev/null; then
  warn "Stopping a leftover build from an interrupted update."
  fuser -k -TERM "$NEXT_LOCK" >/dev/null 2>&1 || true
  sleep 3
  fuser -k -KILL "$NEXT_LOCK" >/dev/null 2>&1 || true
fi
if id "$APP_USER" >/dev/null 2>&1; then pkill -u "$APP_USER" -f "next build|jest-worker|next/dist/compiled/.*worker" 2>/dev/null || true; fi
rm -f "$NEXT_LOCK"
# Commands run by hand as root (e.g. a manual `pnpm build`) leave root-owned files the app user can't
# overwrite ("Build directory is not writeable"). The app directory always belongs to the app user.
if [[ -d "$APP_DIR" ]] && id "$APP_USER" >/dev/null 2>&1; then
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
  [[ -d "$BASE/next-previous" ]] && chown -R "$APP_USER:$APP_USER" "$BASE/next-previous"
fi
. /etc/os-release
[[ "${ID:-}" == "ubuntu" ]] || die "This installer supports Ubuntu 22.04 / 24.04 only."
export DEBIAN_FRONTEND=noninteractive

FIRST_RUN=1
[[ -f "$APP_DIR/.env" ]] && FIRST_RUN=0

# ───────────── Questions (first run only) ─────────────
if [[ $FIRST_RUN -eq 1 ]]; then
  if [[ -z "${DOMAIN+x}" ]]; then
    echo "Domain of the site (e.g. atomgameclub.ir). Its DNS A record must point to this server."
    read -r -p "Leave empty to use the server IP (no HTTPS): " DOMAIN </dev/tty || DOMAIN=""
  fi
  DOMAIN="$(echo "${DOMAIN:-}" | tr '[:upper:]' '[:lower:]' | sed -E 's#^https?://##; s#/.*$##')"
  if [[ -n "$DOMAIN" && -z "${EMAIL+x}" ]]; then
    read -r -p "Email for the HTTPS certificate (optional): " EMAIL </dev/tty || EMAIL=""
  fi
fi

# ───────────── System packages ─────────────
say "Installing system packages"
apt-get update -y
apt-get install -y ca-certificates curl git sudo nginx postgresql postgresql-contrib ufw fail2ban cron xz-utils psmisc
if [[ -n "${DOMAIN:-}" ]]; then apt-get install -y certbot python3-certbot-nginx; fi

# Building needs ~2 GB of memory: add swap on small servers.
if [[ $NO_SYSTEMD != 1 ]] && [[ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3500 ]] && ! swapon --show | grep -q .; then
  say "Adding 2 GB swap"
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ───────────── Node.js 22 ─────────────
node_ok() { command -v node >/dev/null && [[ "$(node -p 'process.versions.node.split(".")[0]')" -ge $NODE_MAJOR ]]; }
install_node_tarball() {
  local base="$1" arch
  case "$(uname -m)" in x86_64) arch=x64 ;; aarch64) arch=arm64 ;; *) return 1 ;; esac
  local file="node-v$NODE_VERSION_FALLBACK-linux-$arch.tar.xz"
  curl -fsSL --max-time 300 "$base/v$NODE_VERSION_FALLBACK/$file" -o "/tmp/$file" || return 1
  tar -xJf "/tmp/$file" -C /usr/local --strip-components=1 && rm -f "/tmp/$file"
}
if ! node_ok; then
  say "Installing Node.js $NODE_MAJOR"
  if curl -fsSL --max-time 60 "https://deb.nodesource.com/setup_$NODE_MAJOR.x" -o /tmp/nodesource.sh && bash /tmp/nodesource.sh && apt-get install -y nodejs; then :; fi
  node_ok || install_node_tarball "https://nodejs.org/dist" || install_node_tarball "https://registry.npmmirror.com/-/binary/node" || true
  hash -r
  node_ok || die "Could not install Node.js $NODE_MAJOR (downloads blocked?). Enable international traffic on the server and run again."
fi
echo "node $(node -v)"

if [[ -n "${NPM_REGISTRY:-}" ]]; then npm config set registry "$NPM_REGISTRY" --location=global; fi
if ! command -v pnpm >/dev/null; then
  say "Installing pnpm"
  npm install -g pnpm@10
  hash -r
fi
command -v pnpm >/dev/null || die "Could not install pnpm."
# Make node/npm/pnpm visible to the app user, systemd and cron (standard paths only).
for bin in node npm pnpm; do
  p="$(command -v "$bin")"
  case "$p" in /usr/bin/*|/usr/local/bin/*) ;; *) ln -sf "$p" "/usr/local/bin/$bin" ;; esac
done
PNPM_BIN="$(command -v pnpm)"
case "$PNPM_BIN" in /usr/bin/*|/usr/local/bin/*) ;; *) PNPM_BIN=/usr/local/bin/pnpm ;; esac

# ───────────── User, folders, database ─────────────
say "Preparing user, folders and database"
id "$APP_USER" >/dev/null 2>&1 || adduser --system --group --home "$BASE" --shell /bin/bash "$APP_USER"
mkdir -p "$BASE" "$UPLOAD_DIR" "$BACKUP_DIR"
chown "$APP_USER:$APP_USER" "$BASE" "$UPLOAD_DIR" "$BACKUP_DIR"
chmod 750 "$BASE" "$BACKUP_DIR"
if [[ -n "${NPM_REGISTRY:-}" ]]; then sudo -u "$APP_USER" -H npm config set registry "$NPM_REGISTRY"; fi

if [[ $NO_SYSTEMD == 1 ]]; then service postgresql start >/dev/null; else systemctl enable --now postgresql; fi

DB_PASS=""
if [[ $FIRST_RUN -eq 1 ]]; then
  DB_PASS="$(openssl rand -hex 24)"
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$APP_USER'" | grep -q 1; then
    sudo -u postgres psql -qc "ALTER ROLE $APP_USER WITH LOGIN PASSWORD '$DB_PASS'"
  else
    sudo -u postgres psql -qc "CREATE ROLE $APP_USER WITH LOGIN PASSWORD '$DB_PASS'"
  fi
  sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='atom'" | grep -q 1 \
    || sudo -u postgres createdb -O "$APP_USER" -E UTF8 -T template0 atom
fi

# ───────────── Code ─────────────
say "Getting the latest code"
if [[ -d "$APP_DIR/.git" ]]; then
  as_app "git fetch --depth 1 origin '$BRANCH' && git reset --hard 'origin/$BRANCH'"
else
  sudo -u "$APP_USER" -H --preserve-env="$KEEP_ENV" git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# ───────────── nginx (+ HTTPS) ─────────────
# Branded page for 502/503/504 (site restarting, updating or down), served by nginx itself.
# Copied outside /srv/atom because nginx (www-data) can't read the app directory.
ERROR_PAGES=/var/www/atom-errors
install_error_pages() {
  mkdir -p "$ERROR_PAGES"
  cp -f "$APP_DIR"/deploy/errors/* "$ERROR_PAGES"/
  chmod 755 "$ERROR_PAGES" && chmod 644 "$ERROR_PAGES"/*
  cat > /etc/nginx/snippets/atom-errors.conf <<EOF
error_page 502 503 504 /__atom_errors/50x.html;
location ^~ /__atom_errors/ {
    alias $ERROR_PAGES/;
    add_header Cache-Control "no-store" always;
}
EOF
}
install_error_pages

SERVER_NAME="${DOMAIN:-_}"
write_nginx() {
  local listen6=""
  [[ -s /proc/net/if_inet6 ]] && listen6="listen [::]:80 default_server;"
  cat > /etc/nginx/snippets/atom-proxy.conf <<EOF
proxy_pass http://127.0.0.1:$PORT;
proxy_http_version 1.1;
proxy_set_header Host \$host;
proxy_set_header X-Real-IP \$remote_addr;
proxy_set_header X-Forwarded-For \$remote_addr;
proxy_set_header X-Forwarded-Proto \$scheme;
EOF
  cat > /etc/nginx/sites-available/atom <<EOF
server {
    listen 80 default_server;
    $listen6
    server_name $SERVER_NAME;
    client_max_body_size 8m;
    include /etc/nginx/snippets/atom-errors.conf;

    location = /api/admin/catalog/import {
        client_max_body_size 200m;
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
EOF
  ln -sf /etc/nginx/sites-available/atom /etc/nginx/sites-enabled/atom
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  if [[ $NO_SYSTEMD == 1 ]]; then service nginx restart >/dev/null || nginx; else systemctl enable nginx && systemctl reload-or-restart nginx; fi
}

APP_URL=""
if [[ $FIRST_RUN -eq 1 ]]; then
  say "Configuring nginx"
  write_nginx
  if [[ -n "${DOMAIN:-}" ]]; then
    say "Requesting an HTTPS certificate for $DOMAIN"
    CERT_ARGS=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
    if [[ -n "${EMAIL:-}" ]]; then CERT_ARGS+=(-m "$EMAIL"); else CERT_ARGS+=(--register-unsafely-without-email); fi
    if certbot "${CERT_ARGS[@]}"; then
      APP_URL="https://$DOMAIN"
    else
      warn "Could not get a certificate (is the domain's A record pointing to this server?). Using http for now."
      warn "Later: run 'certbot --nginx -d $DOMAIN', set APP_URL=https://$DOMAIN in $APP_DIR/.env and run this installer again."
      APP_URL="http://$DOMAIN"
    fi
  else
    IP="$(curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
    APP_URL="http://$IP"
  fi
elif [[ -f /etc/nginx/sites-available/atom ]] && ! grep -q "atom-errors.conf" /etc/nginx/sites-available/atom; then
  # Servers installed before the error page existed: add it to the existing config (kept otherwise as is).
  say "Adding the branded error page to nginx"
  cp /etc/nginx/sites-available/atom /etc/nginx/sites-available/atom.bak
  sed -i '/client_max_body_size 8m;/a\    include /etc/nginx/snippets/atom-errors.conf;' /etc/nginx/sites-available/atom
  if nginx -t 2>/dev/null; then
    if [[ $NO_SYSTEMD == 1 ]]; then nginx -s reload || true; else systemctl reload nginx; fi
  else
    warn "nginx rejected the error page config — restored the previous config."
    cp /etc/nginx/sites-available/atom.bak /etc/nginx/sites-available/atom
  fi
fi

# ───────────── .env (first run only; never overwritten) ─────────────
if [[ $FIRST_RUN -eq 1 ]]; then
  say "Writing settings (.env)"
  umask 077
  cat > "$APP_DIR/.env" <<EOF
# Server settings for ATOM GAME CLUB. Keep private. Created by install-server.sh
DATABASE_URL="postgresql://$APP_USER:$DB_PASS@127.0.0.1:5432/atom?schema=public"
AUTH_SECRET="$(openssl rand -base64 32)"
APP_URL="$APP_URL"
UPLOAD_DIR="$UPLOAD_DIR"
PAYMENT_PROVIDER="disabled"
# SMS: set SMS_PROVIDER="smsir" with SMS_API_KEY / SMS_TEMPLATE_ID (works only from an Iranian server)
SMS_PROVIDER="log"
SMS_TEMPLATE_ID="490537"
SMS_TEMPLATE_PARAM="CODE"
MAIL_PROVIDER="log"
EOF
  umask 022
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi

# ───────────── Install, migrate, build ─────────────
say "Installing packages (a few minutes)"
as_app "pnpm install --frozen-lockfile"
if [[ $FIRST_RUN -eq 0 ]]; then
  say "Backing up before the update"
  as_app "BACKUP_DIR='$BACKUP_DIR' ./scripts/backup.sh" || warn "Backup failed — continuing."
fi
say "Updating the database"
as_app "pnpm db:deploy"
say "Building the site (a few minutes)"
# Keep the last working build: `next build` empties .next first, so a failed build would take the site down.
PREV_BUILD="$BASE/next-previous"
rm -rf "$PREV_BUILD"
if [[ -f "$APP_DIR/.next/BUILD_ID" ]]; then cp -a "$APP_DIR/.next" "$PREV_BUILD"; fi
if ! as_app "set -o pipefail; NODE_OPTIONS=--max-old-space-size=1536 pnpm build 2>&1 | tee '$BASE/build.log'"; then
  free -m || true
  if [[ -d "$PREV_BUILD" ]]; then
    rm -rf "$APP_DIR/.next" && cp -a "$PREV_BUILD" "$APP_DIR/.next"
    [[ $NO_SYSTEMD == 1 ]] || systemctl restart atom || true
    die "Build failed — the previous version was restored and is running. Full log: $BASE/build.log"
  fi
  die "Build failed. Full log: $BASE/build.log"
fi
rm -rf "$PREV_BUILD"

# ───────────── Service ─────────────
say "Starting the site"
if [[ $NO_SYSTEMD == 1 ]]; then
  pkill -u "$APP_USER" -f "next-server" 2>/dev/null || true
  sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && NODE_ENV=production nohup pnpm start -H 127.0.0.1 -p $PORT > '$BASE/app.log' 2>&1 &"
else
  cat > /etc/systemd/system/atom.service <<EOF
[Unit]
Description=ATOM GAME CLUB (Next.js)
After=network.target postgresql.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=$PNPM_BIN start -H 127.0.0.1 -p $PORT
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=$BASE

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable atom >/dev/null
  systemctl restart atom
fi
for _ in $(seq 1 60); do curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && break; sleep 1; done
curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null || die "The site did not start. Check: journalctl -u atom -n 50"

# ───────────── Firewall, scheduled jobs ─────────────
if [[ $NO_SYSTEMD != 1 ]]; then
  say "Firewall (22, 80, 443) and login protection"
  ufw allow 22/tcp >/dev/null && ufw allow 80/tcp >/dev/null && ufw allow 443/tcp >/dev/null
  ufw --force enable >/dev/null
  systemctl enable --now fail2ban >/dev/null
  systemctl enable --now cron >/dev/null
fi
CRON_FILE="$(mktemp)"
cat > "$CRON_FILE" <<EOF
PATH=/usr/local/bin:/usr/bin:/bin
30 3 * * * cd $APP_DIR && $PNPM_BIN -s maintenance --media >> $BASE/maintenance.log 2>&1
0 4 * * * cd $APP_DIR && BACKUP_DIR=$BACKUP_DIR KEEP_DAYS=14 ./scripts/backup.sh >> $BASE/backup.log 2>&1
EOF
crontab -u "$APP_USER" "$CRON_FILE" && rm -f "$CRON_FILE"

URL="$(grep -E '^APP_URL=' "$APP_DIR/.env" | cut -d'"' -f2)"
ADMINS="$(sudo -u postgres psql -d atom -tAc "SELECT count(*) FROM users WHERE role='ADMIN'" 2>/dev/null || echo 0)"
printf '\n\033[1;32m✓ ATOM GAME CLUB is running: %s\033[0m\n' "$URL"
if [[ "${ADMINS// /}" == "0" ]]; then
  echo
  echo "Next step — create the admin account:"
  echo "  sudo -u $APP_USER -H bash -c 'cd $APP_DIR && pnpm admin:create'"
fi
echo "Update later: run this installer again (bash $APP_DIR/scripts/install-server.sh)."
