# 3D world: achievements, points and discount cards

Owner request (2026-10-27): several achievements per game, one of them hidden; points that buy discount cards
(e.g. 1000 points → 10 % card); everything editable by the manager. Owner answers: points from achievements **and**
every round; only for logged-in site accounts; the manager chooses per card where it is used (in-store / online).

## How it works

| Step | Where |
|---|---|
| A round starts (logged in): the site issues a one-time round token (HMAC with `AUTH_SECRET`, user + game + start time). | `POST /api/game-rewards/start`, `features/game-rewards/round-token.ts` |
| The player finishes the round; the game reports it with the token. The site times the round itself, refuses rounds shorter than `MIN_ROUND_SECONDS` or with impossible numbers (`plausibleRound`), and counts each token once. | `src/atom-world/minigames/MiniGameHost.tsx` → `POST /api/game-rewards/round` |
| The server gives the round points (capped) and re-checks the achievement tests against the round's stats (same pure tests the game uses: `src/atom-world/minigames/achievementList.ts`), each achievement once per account. | `src/features/game-rewards/rules.ts` (`computeRound`), `service.ts` (`recordRound`) |
| «⭐ امتیاز و جایزه» in the world's scores panel: balance, the manager's cards, «کارت‌های من» with codes. | `RewardsPanel.tsx`, `GET /api/game-rewards` |
| Taking a card spends its points and issues a code `ATOM-XXXX-XXXX`. | `POST /api/game-rewards/redeem` → `redeemCard` |
| In-store: the counter types the code in **Admin → دستاوردها و جوایز → بررسی کد** and presses «ثبت استفاده». | `/admin/game-rewards/codes` |
| Online: the code goes into «کد کارت تخفیف اتم» at checkout; the discount (percent of the products, not shipping) is applied inside the order transaction; a cancelled / failed order gives the card back. | `features/orders/actions.ts` (`placeOrder`), `orders/service.ts` (`cancelOrderTx`) |

## What the manager edits (Admin → دستاوردها و جوایز, ADMIN only)

- **قوانین امتیاز و دستاوردها**: on/off, points per round, counted rounds per day (Tehran day), minimum seconds
  between counted rounds, «دفعات بازی هر مینی‌گیم بدون حساب» (visitors without an account; default 1, 0 = no
  limit), points per achievement (empty = the game's default; 0 = none). Stored in
  `site_settings` key `game-rewards`.
- **کارت‌های تخفیف**: title, description, points, percent, where it is used (حضوری / آنلاین / هر دو), validity in
  days, limit per account per 30 days (0 = none), active, order. Online cards are limited to 90 % (the payment gateway
  needs an amount above zero).
- **بررسی کد و امتیاز کاربر**: look up a code (typing is forgiving: lower case, spaces, Persian digits), accept it
  in-store, cancel it with or without refunding the points; manual points correction for a user (+/−, with a reason;
  never below zero); the last 30 cards taken.

Every admin change is in the audit log (`rewards.*`).

## Achievements

At least three per game plus one hidden one (shown as «دستاورد مخفی» until earned), and two for the whole world.
Defaults (points): first steps 50, harder ones 100–150, hidden 250 (200 for «جهانگرد اتم»). The ids never change
(they are stored on accounts). New achievements are added in gameatom's `achievementList.ts` and copied with
`scripts/sync-to-site.sh`. Device-only achievements still work for players who are not logged in (no points).

## Data

- `game_points_entries`: the ledger (`ROUND`, `ACHIEVEMENT`, `REDEEM` −, `REFUND`, `ADJUST`); balance = sum. Rows are
  never edited. A round without points is stored once per game (it counts for «play every game»).
- `game_achievement_unlocks`: one row per account and achievement (primary key → no double points).
- `reward_cards`: the manager's cards. `reward_redemptions`: issued cards with a snapshot of title, percent and channel;
  status `ACTIVE` / `USED` / `CANCELLED` (active past its date = expired); `usedById` (counter) or `orderId` (online).
- Points and cards are changed only inside transactions that lock the user's row (`SELECT … FOR UPDATE`), so two
  requests at once cannot spend the same points twice (verified: two parallel redeems with points for one → one card).

## Limits and honesty

The mini-games run in the player's browser, so a determined person can fake round results. What bounds it:
login required (visitors without an account earn nothing and may play each game only `guestRoundsPerGame`
times — counted on their device, then the world asks them to log in); every round must be started on the server
(one-time token), last a real minimum time and report possible numbers for that time (owner request 2026-11-01);
same-origin only; rate limits (20 rounds / minute, 10 cards / hour per account); counted rounds per day
and a minimum gap; achievements only once and only when the reported stats pass the real test. So the most anyone can
earn is about `perRound × roundsPerDay` per day plus the one-time sum of all achievements (both shown on the rules
page). Set card costs and per-account limits with that in mind; for big prizes, prefer in-store cards (the counter sees
the person).

## Verified (2026-10-27)

Unit: `tests/unit/game-rewards.test.ts` (cap, gap, once-only, server-side achievement check, Tehran day, codes, discount,
90 % rule), `tests/unit/atom-world/achievementList.test.ts`. Against the local database: parallel redeems, 30-day limit,
no negative balance, in-store once, cancel + refund, someone else's card refused at checkout, card on an order not
reusable, cancelled order gives the card back. Browser: admin rules / cards / code check, rounds and achievements via
the API, balance and taking a card in the world, hidden achievements, counter acceptance; checkout with the sandbox
gateway (dev only): summary −10 %, failed payment → card back, paid → card used, totals stored on the order.
