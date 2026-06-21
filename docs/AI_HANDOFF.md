# AI Handoff — Bunny's Whisper

## Project snapshot

Bunny's Whisper is a luxury dark streetwear e-commerce monorepo:

- **Web:** `apps/web` — Next.js 16 (Vercel)
- **API:** `apps/api` — NestJS (Render)
- **Database / Auth / Storage:** Supabase
- **Email:** Resend (via API `EmailModule`)
- **Payments:** Paymob (card) + COD
- **Notifications:** Telegram (order/admin alerts)

## Launch V1.1 additions

1. **Customer wishlist** — heart toggle, `/account/wishlist`, first-wishlist 100 Bunny Points (DB-guarded)
2. **Admin finance tracker** — manual income/expense ledger at `/admin/finance`
3. **Docs** — this `docs/` folder

## Do not break casually

- Checkout / `POST /orders` / Paymob callbacks
- COD order flow and stock reservation RPCs
- Telegram notification triggers
- Transactional emails
- Review submit/approve/public flows
- Admin product CRUD and inventory

## Auth model

- **Customers:** Supabase JWT Bearer token; bootstrap via `POST /auth/bootstrap-customer`
- **Admins:** same JWT + email in `ADMIN_EMAILS` env (API `AdminGuard`)
- API uses **Supabase service role** — all authorization is application-layer

## Where to start

| Task | Location |
|------|----------|
| New customer API route | `apps/api/src/modules/*` + register in `app.module.ts` |
| New admin API route | `admin/*` controller + `@UseGuards(AdminGuard)` |
| New web page | `apps/web/app/...` |
| DB change | `supabase/migrations/YYYYMMDDHHMMSS_*.sql` then apply in Supabase |
| Env vars | `apps/api/.env`, `apps/web/.env.local` (never commit) |

## Build commands

```bash
cd apps/api && npm run build
cd apps/web && npm run build
```

## Migrations to apply for V1.1 + hardening

- `20260525120000_customer_wishlists_launch.sql`
- `20260525120100_admin_finance_entries.sql`
- `20260526120000_security_hardening_indexes_rls.sql`

Apply in Supabase SQL editor or CLI before testing wishlist/finance in production.

## Security / performance hardening (latest pass)

- API: throttling on public products, admin orders/inventory/event-qr; UUID param validation; finance pagination; review offset caps; admin orders safety limit (2000)
- Web: finance CSV formula-injection escape
- DB: indexes + RLS revoke on V1.1 sensitive tables
- Docs: `SECURITY_CHECKLIST.md`, load testing section in `TESTING_CHECKLIST.md`

**Not changed:** checkout flow, Paymob webhook logic, order RPCs, wishlist reward rules, UI styling.
