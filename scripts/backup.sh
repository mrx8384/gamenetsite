#!/usr/bin/env bash
# Nightly backup: PostgreSQL dump + uploaded files, with retention.
#
#   BACKUP_DIR=/var/backups/atom KEEP_DAYS=14 ./scripts/backup.sh
#
# Reads DATABASE_URL and UPLOAD_DIR from the environment or from ./.env.
# Restore: see docs/DEPLOYMENT.md §7.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a; source .env; set +a
fi

: "${DATABASE_URL:?DATABASE_URL is not set}"
UPLOAD_DIR="${UPLOAD_DIR:-./storage/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/atom}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_URL="${DATABASE_URL%%\?*}"   # pg_dump does not accept Prisma's ?schema= parameter

umask 077                        # backups contain personal data: owner-only
mkdir -p "$BACKUP_DIR"

pg_dump --format=custom --no-owner --file="$BACKUP_DIR/db-$STAMP.dump" "$DB_URL"
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
# 3D world editor data (layout, texts, photos), kept beside the uploads once the manager has saved
WORLD_DIR="${ATOM_WORLD_DATA_DIR:-$(dirname "$UPLOAD_DIR")/atom-world}"
if [[ -d "$WORLD_DIR" ]]; then
  tar -czf "$BACKUP_DIR/atom-world-$STAMP.tar.gz" -C "$(dirname "$WORLD_DIR")" "$(basename "$WORLD_DIR")"
fi

# Sanity check: the dump must be readable.
pg_restore --list "$BACKUP_DIR/db-$STAMP.dump" > /dev/null

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' -o -name 'atom-world-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "backup ok: $BACKUP_DIR/db-$STAMP.dump, $BACKUP_DIR/uploads-$STAMP.tar.gz"
