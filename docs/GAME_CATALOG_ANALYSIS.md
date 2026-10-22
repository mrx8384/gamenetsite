# Game Catalog Analysis

Source: `game-catalog.zip` (uploaded 2026-10-22). Original files preserved unchanged in `services/game-catalog/`.

## 1. Archive contents

| File | Size | Notes |
|---|---|---|
| `server.py` | 70 KB, 1,904 lines | Whole app: server, DB layer, 3 embedded HTML pages, embedded QR library |
| `DATABASE.md` | 3.4 KB | Persian guide to the SQLite DB, export and restore |
| `logo.png` | 256×256 PNG | ATOM logo (same design as the uploaded high-res logo) |
| `start.bat` | 69 B | Windows launcher: `python server.py` |

Safety check: 4 regular files, no path traversal, no symlinks, no binaries besides the PNG.

**No `data/catalog.db` is included.** The live catalog data exists only on the owner's machine. The importer must be run against that file later.

## 2. Technical architecture

- **Runtime:** Python 3 standard library only (`http.server.ThreadingHTTPServer`, `sqlite3`, `zipfile`, ...). No third-party dependencies, no `requirements.txt`.
- **Server:** single `BaseHTTPRequestHandler` class with manual `if path == ...` routing. Port hard-coded to `8080`, bound to `0.0.0.0`. Opens the admin page in a browser on start.
- **Purpose / deployment model:** a **LAN tool** for a game café. The owner runs it on one PC; customers on the same Wi-Fi scan a QR code to browse the catalog on their phones.
- **Rendering:** three HTML strings embedded in `server.py` (`HOME`, `VIEW`, `ADMIN`). Each page is static HTML + inline CSS + vanilla JS that fetches JSON from `/api/*` and renders on the client. No templates, no build step.
- **Visual style:** dark theme (`#0d0e12`), green→yellow gradients (`#00d664`, `#ffdd00`), Tahoma font. Does not match the new light ATOM design.

## 3. Database

SQLite file `data/catalog.db`, schema version in `PRAGMA user_version` (currently `2`).

```sql
categories(id INTEGER PK AUTOINCREMENT,
           platform TEXT NOT NULL DEFAULT 'ps4',   -- 'ps4' | 'ps5'
           name TEXT NOT NULL,                     -- max 40 chars (app-enforced)
           position INTEGER NOT NULL DEFAULT 0,
           UNIQUE(platform, name))
games(id TEXT PK,                                  -- 12 hex chars (uuid4 prefix)
      name TEXT NOT NULL,                          -- max 80 chars (app-enforced)
      category_id INTEGER NOT NULL REFERENCES categories(id),
      image BLOB NOT NULL,                         -- JPEG bytes, resized client-side to max 480px wide
      image_type TEXT NOT NULL DEFAULT 'image/jpeg',
      created_at INTEGER, updated_at INTEGER,      -- unix seconds
      platform TEXT NOT NULL DEFAULT 'ps4')
```

Business rules found in code:

- Each platform has its own categories. A locked default category `بدون دسته` ("uncategorized") always exists per platform and cannot be renamed or deleted. It is hidden from lists when empty.
- Categories are created implicitly when a game is saved with a new category name.
- Renaming a category to an existing name **merges** the two.
- Deleting a category moves its games to `بدون دسته` (games are never deleted with a category).
- Moving a game to the other platform keeps its category name (creating it on the target platform if needed).
- Images are JPEG only, resized in the browser (max width 480 px, quality 0.82) before upload.
- Automatic migrations: v1 → v2 (adds platforms; old data goes to PS4) and legacy `games.json` + `img/` → SQLite (old files renamed to `.bak`, not deleted).

## 4. Endpoints

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/` | public | Home: pick PS4 / PS5, game counts, last 4 covers |
| GET | `/ps4`, `/ps5` | public | Platform catalog page |
| GET | `/admin` | local only | Admin panel |
| GET | `/api/games?p=ps4\|ps5` | public | `[{id, name, category, v}]` (`v` = updated_at, used as cache buster) |
| GET | `/api/categories?p=` | local only | `[{name, locked, count}]` |
| GET | `/api/info` | local only | LAN URL for the QR code |
| GET | `/api/export/db` | local only | Download a consistent SQLite backup (`sqlite3.backup`) |
| GET | `/api/export/zip` | local only | Download `catalog.json` + `images/<id>.jpg` |
| GET | `/logo.png` | public | Logo |
| GET | `/img/<12-hex>.jpg` | public | Game cover from BLOB, cached 1 day |
| POST | `/api/add` | local only | `{name, category, platform, image: dataURL}` |
| POST | `/api/update` | local only | `{id, name?, category?, image?, platform?}` |
| POST | `/api/delete` | local only | `{id}` |
| POST | `/api/cat/add` | local only | `{name, platform}` |
| POST | `/api/cat/rename` | local only | `{old, new, platform}` (merges on conflict) |
| POST | `/api/cat/delete` | local only | `{name, platform}` |
| POST | `/api/import` | local only | Raw `.db` body; validates tables + `integrity_check`; backs up current DB to `catalog.before-import.db`, then replaces it |

## 5. Feature inventory (must be preserved)

**Public**
1. Platform chooser (PS4 / PS5) with game counts and recent cover thumbnails
2. Catalog grid grouped by category, with a count per category
3. Instant text search
4. Category filter chips with counts
5. Lightbox: next/prev buttons, keyboard arrows, Esc, swipe on touch, position counter
6. Auto-refresh every 3 s (new games appear without reload)
7. Lazy-loaded images, mobile-first layout, RTL

**Admin**
8. QR code + LAN URL for customers
9. PS4 / PS5 tabs (remembered in `localStorage`)
10. Add a game: name, category (with suggestion tags), image picker, drag-and-drop
11. **Bulk upload:** many images at once; names taken from file names
12. Client-side image resize/compress before upload
13. Per game: rename, change category, replace image, move to other platform, delete (with confirm)
14. Categories: add, rename (merge on conflict), delete (games moved to default)
15. Backup: download `.db`, download ZIP (JSON + images)
16. Restore from `.db` with validation and automatic pre-restore backup
17. Automatic schema migrations, including the legacy JSON format

## 6. Baseline test (2026-10-22)

Run in an isolated copy with Python 3.13 and a fresh empty DB. **All endpoints worked:** all pages returned 200; add category, add game, image serving, move platform, category rename + delete (game moved to `بدون دسته`), export `.db`, export ZIP, import `.db` (backup file created) and delete game all succeeded.

## 7. Security findings

| # | Finding | Impact if put on the public web |
|---|---|---|
| S1 | Admin access depends only on `client_address == 127.0.0.1`. | **Critical behind a reverse proxy:** every proxied request comes from 127.0.0.1, so **every visitor would get full admin rights**. |
| S2 | No CSRF protection. POST bodies are read as JSON regardless of `Content-Type`, so a cross-site `text/plain` form/fetch works with no preflight. | Any web page the admin visits can delete or replace catalog data on the admin's machine. |
| S3 | No user accounts or audit trail. | Can't connect to ATOM roles (`ADMIN`). |
| S4 | Image upload only checks the `data:image/jpeg;base64,` prefix, not the actual bytes. Served without `X-Content-Type-Options: nosniff`. | Low, but should be fixed. |
| S5 | `/api/import` accepts up to 1 GB and replaces the whole DB. | Acceptable for a local tool; risky if exposed. |
| S6 | Port, bind address and browser auto-open are hard-coded. | Needs code edits to run as a server process. |

S1 and S2 are acceptable for a LAN tool on the owner's PC but **not** for a public website.

## 8. Integration options

### A. Reverse proxy `/game-catalog` → Python (keep code as is)
- ❌ Rejected. Because of S1, it exposes the admin API to the whole internet unless the code is changed. The pages also use absolute paths (`/api/...`, `/img/...`, `/ps4`), so mounting under `/game-catalog` needs path rewriting.

### B. Python as a private backend, Next.js as gatekeeper + UI
- Python runs on an internal network only. Next.js serves the public pages and calls Python server-side. Admin actions go through Next.js after an `ADMIN` check.
- ✅ Python code mostly unchanged.
- ❌ Two runtimes and two databases (SQLite + PostgreSQL) to deploy and back up. `0.0.0.0` binding and browser auto-open need small code edits or container isolation. Admin features in the new panel would still have to be rebuilt in React. Images stay as BLOBs.

### C. Port the catalog into the Next.js app + PostgreSQL (recommended) — **needs approval**
- Rebuild the same features (all 17 above) as an ATOM module, using the same data model and business rules.
- A **lossless importer** reads the existing `catalog.db` (v1 and v2) or the ZIP export, and keeps the original game IDs. The original `.db` is never modified.
- Admin lives in the central `/admin` panel with real `ADMIN` authorization, CSRF protection and audit log.
- ZIP export keeps the exact `catalog.json` format. `.db` export can keep the original SQLite schema, so the original Python app can still open backups.
- The original Python app stays in `services/game-catalog/` unchanged and can still run as a local LAN tool on the café PC if wanted.
- Reading/writing SQLite uses Node 22's built-in `node:sqlite` module (no new dependency). Fallback if needed: `better-sqlite3`.
- ✅ One runtime, one database, one design system, one login, proper security.
- ❌ Most work of the three. Requires the owner's approval, since the instructions say not to rewrite without approval.

**Why C is recommended:** the catalog is small (2 tables, about 17 features, about 350 lines of real logic outside the embedded QR library). The data model is simple and maps cleanly to Prisma. The main obstacles to keeping it as is (local-only auth, no CSRF, separate runtime, BLOB storage) are exactly what the new platform must solve anyway. The risk of the port is controlled by the lossless importer and by keeping the original app untouched.

## 9. Proposed module mapping (option C)

| Original | New |
|---|---|
| `/` platform chooser | `/game-catalog` |
| `/ps4`, `/ps5` | `/game-catalog/ps4`, `/game-catalog/ps5` |
| `/img/<id>.jpg` | `/game-catalog/img/<id>.jpg` (same IDs; cached, `nosniff`) |
| `/admin` | `/admin/game-catalog` (ADMIN only) |
| QR + LAN URL | QR of the public site URL (`/game-catalog/ps5` etc.) for printing in the café |
| 3 s polling | Kept as an optional light revalidation (or replaced by cache revalidation on change) |
| BLOB images | Image files in upload storage (original bytes kept). Importer extracts BLOBs |

## 10. Owner decisions (2026-10-22)

1. **Option C approved.** Catalog admin requires ADMIN login with password.
2. Live database received: `atom-catalog-20261022.db` (see §11).
3. The original Python app will **not** be used after launch → no sync needed.
4. "Whichever is better" → **ZIP export** (portable JSON + JPEG files) plus **import from `.db`** (original format, v1 and v2) and full PostgreSQL backups. `.db` export is not needed since the Python app is retired.

## 11. Live data inspection (2026-10-22, read-only)

- File SHA-256: `e67cb853418eb2a949c4433a23039a60ef5668b882c0065e28dbaf3b22f737fc`, 3.9 MB, `PRAGMA user_version = 2`, `integrity_check = ok`.
- **85 games** (PS4: 56, PS5: 29), **7 categories**:
  - PS4: بدون دسته (0), زیرنویس فارسی دو نفره (2), دو نفره (54)
  - PS5: بدون دسته (0), داستانی (19), زیرنویس فارسی (2), دو نفره (8)
- Images: all 85 are valid JPEG (magic bytes checked), 12.9–85.8 KB each, 3.7 MB total.
- No orphan games, no platform/category mismatches, all IDs are 12 lowercase hex chars, no empty names, no null timestamps.
- Insertion order (`rowid`) equals `created_at` order → the new app orders by `createdAt, id` and keeps the original order.
- Data note: two PS4 games are named `images` (bulk-upload file names). Imported as-is; owner may rename.
