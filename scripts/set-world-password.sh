#!/usr/bin/env bash
# Sets (or removes) the 3D world editor password on the server and restarts the site.
#
#   sudo bash /srv/atom/app/scripts/set-world-password.sh          # asks for the new password twice
#   sudo bash /srv/atom/app/scripts/set-world-password.sh --remove # editor only via site ADMIN accounts
#
# The password goes into .env as ATOM_WORLD_ADMIN_PASSWORD (at least 10 characters). Changing it signs out
# everyone who logged in with the old one. Site ADMIN accounts can always open /atom-world/admin as well.
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-$PWD/.env}"
[[ -f "$ENV_FILE" ]] || { echo "No .env at $ENV_FILE (run the installer first)." >&2; exit 1; }

remove_line() { sed -i '/^ATOM_WORLD_ADMIN_PASSWORD=/d' "$ENV_FILE"; }

if [[ "${1:-}" == "--remove" ]]; then
  remove_line
  echo "Editor password removed."
else
  read -rsp "New editor password (at least 10 characters): " p1; echo
  read -rsp "Repeat it: " p2; echo
  [[ "$p1" == "$p2" ]] || { echo "The two passwords are not the same." >&2; exit 1; }
  [[ ${#p1} -ge 10 ]] || { echo "Too short: at least 10 characters." >&2; exit 1; }
  [[ "$p1" != *$'\n'* && "$p1" != *'"'* && "$p1" != *'\'* && "$p1" != *'$'* && "$p1" != *'`'* ]] || { echo 'Please do not use " \ $ or ` in the password.' >&2; exit 1; }
  remove_line
  printf 'ATOM_WORLD_ADMIN_PASSWORD="%s"\n' "$p1" >> "$ENV_FILE"
  echo "Editor password saved."
fi
chmod 600 "$ENV_FILE"

# the app reads .env when it starts: restart it
if command -v systemctl >/dev/null && systemctl list-unit-files atom.service >/dev/null 2>&1 && systemctl cat atom >/dev/null 2>&1; then
  systemctl restart atom && echo "Site restarted. Open /atom-world/admin and log in."
else
  echo "Restart the site yourself so the change takes effect (e.g. run the installer again)."
fi
