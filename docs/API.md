# ATOM GAME CLUB — Public API v1

For the owner's other apps (owner request 2026-11-15). Server-to-server only; no browser CORS.

- Base URL: `https://www.atomgclub.ir/api/v1`
- Auth: `Authorization: Bearer atm_…` — keys are made in **Admin → کلیدهای API** (shown once; only a SHA-256 is stored; revoke there).
- Scopes: `booking:read`, `booking:write`, `discount:read`.
- Limit: 120 requests / minute / key (`429 rate_limited`, `Retry-After: 60`).
- Responses: `{ "success": true, "data": … }` or `{ "success": false, "code": "…", "message": "<Persian text>" }`.
- Dates are Tehran calendar days `YYYY-MM-DD` (Gregorian); times `HH:mm` Tehran; `endsNextDay` when a shift passes midnight.
- Money: `{ "rial": "50000000", "toman": 5000000 }` (rial as string).
- Errors: `401 unauthorized`, `403 forbidden` (missing scope), `400 invalid_*`, `404 not_found`, `409 booking_rejected` / `invalid_transition`, `422 validation_error`, `429 rate_limited`.

## Endpoints

| Method | Path | Scope | Notes |
|---|---|---|---|
| GET | `/ping` | booking:read | key name, scopes, server time |
| GET | `/booking/shifts` | booking:read | all shifts (`weekdays`: 0 = Saturday … 6 = Friday) |
| GET | `/booking/availability?from=YYYY-MM-DD&days=7` | booking:read | per day: `closed`, shifts with `capacity`, `taken`, `left`, `state` (`open`/`full`/`closed`/`past`), max 62 days |
| GET | `/bookings?from=&to=&status=` | booking:read | default today … +30 days, max 200 rows |
| POST | `/bookings` | booking:write | body `{ date, shiftId, name, phone, guests?, note?, discountCode? }` → `201` confirmed booking, **paid at the venue** (`source: "API"`); same capacity / closure / discount rules as the website |
| GET | `/bookings/{code}` | booking:read | e.g. `BK-482130` |
| PATCH | `/bookings/{code}` | booking:write | `{ status: "COMPLETED" \| "NO_SHOW" \| "CANCELLED" \| "CONFIRMED", reason? }` — allowed changes: CONFIRMED → COMPLETED/NO_SHOW/CANCELLED, AWAITING_PAYMENT → CANCELLED, COMPLETED/NO_SHOW → CONFIRMED. Cancelling a booking paid online marks it for refund in the admin panel. |
| POST | `/discounts/check` | discount:read | `{ code, scope: "SHOP" \| "BOOKING" \| "TOURNAMENT", amountToman }` → `{ valid, discount }` or `{ valid: false, message }`; nothing is used up |

## Example

```bash
KEY=atm_xxxxxxxx   # from Admin → کلیدهای API
curl -s -H "Authorization: Bearer $KEY" "https://www.atomgclub.ir/api/v1/booking/availability?days=3"
curl -s -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"date":"2026-11-20","shiftId":"<id from /booking/shifts>","name":"علی","phone":"09121234567","guests":12}' \
  https://www.atomgclub.ir/api/v1/bookings
curl -s -X PATCH -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{"status":"COMPLETED"}' \
  https://www.atomgclub.ir/api/v1/bookings/BK-482130
```

Code: `src/features/api/` (auth, scopes, JSON shape) and `src/app/api/v1/**`.
