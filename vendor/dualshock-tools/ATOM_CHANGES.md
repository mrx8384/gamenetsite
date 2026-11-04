# DualShock Calibration GUI — copy used by ATOM GAME CLUB

Source: https://github.com/dualshock-tools/dualshock-tools.github.io (commit b7cdcfaacfadfac5e80f4f40b16e85503a488e63, version 2.35), MIT licence — see `LICENSE.txt` (copyright notice kept).

Served by the site at `/gamepad-tools/…` (`src/app/gamepad-tools/[...path]/route.ts`) only to users allowed to use the gamepad tester, inside the tester page (`src/components/gamepad-tester/gamepad-tools.tsx`, iframe with `allow="hid"`).

Changes made here (the original source is otherwise unchanged; it runs without the original build):
- `index.html`: Bootstrap 5.3.3, Font Awesome 6.6.0 and jQuery 3.7.1 loaded from `lib/` (copies of the official npm packages, SRI hashes kept and verified) instead of CDNs; Google Analytics removed; original favicons/manifest removed; Persian title, RTL and light theme by default; footer replaced by a credit + licence link (no external links).
- `js/utils.js`: analytics (`initAnalyticsApi` / `la`, which posted controller data to the author's server) is a no-op — nothing is sent anywhere.
- `js/translations.js`: Persian by default; local Bootstrap CSS for LTR/RTL; "Missing your language?" link removed.
- `lang/fa_fa.json`: the 271 missing/empty Persian strings translated.
- `css/main.css`, `css/finetune.css`: hand-converted from `scss/` (variables inlined, native CSS nesting).
- `css/atom-theme.css` (loaded after Bootstrap): the site's look — Vazirmatn font (`lib/fonts`, OFL), brand colours for light and dark mode, black text on green buttons, rounded cards with the site shadow, green tabs/switches/focus rings.
- `js/core.js`: controller drawing colours (body/outlines/pressed) changed from blue to the site greens; `js/stick-renderer.js`: stick dot colour likewise. Display only — no HID code touched.
- `js/controller-manager.js`: `_updateUI()` first calls `this.onChangesStateUpdate(hasChanges)` when set (passed to `initControllerManager({ onChangesStateUpdate })`) (the site's native React UI imports these modules directly and has no jQuery); otherwise unchanged.
- `assets/`: the original SVG drawings and `donate.png` (also used by the site's live controller picture).

Licences of the bundled libraries: `lib/jquery.LICENSE.txt`, `lib/bootstrap/LICENSE`, `lib/fontawesome/LICENSE.txt`.
