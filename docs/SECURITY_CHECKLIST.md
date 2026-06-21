# Security Checklist — Bunny's Whisper

Production launch security reference. **Env var names only — never values.**

## Audit summary (hardening pass)

| Area | Status |
|------|--------|
| Admin API routes | All use `AdminGuard` + `ADMIN_EMAILS` |
| Paymob webhook | HMAC SHA-512 + timing-safe compare |
| Order pricing | Server-side RPC `create_order_with_inventory` |
| Paymob finalization | Idempotent; optimistic lock on payment status |
| Wishlist first reward | DB unique `(user_id, event_type)` |
| Points claim/redeem | Atomic RPCs; auth required |
| Global validation | `ValidationPipe` whitelist + forbidNonWhitelisted |
| Web secrets | No service role in web bundle |
| Finance CSV export | Formula-injection cells escaped |

## Apply before launch

- [ ] Apply migrations through `20260526120000_security_hardening_indexes_rls.sql`
- [ ] `ADMIN_EMAILS` on Render
- [ ] `PAYMOB_HMAC_SECRET` on Render; webhook URL in Paymob dashboard
- [ ] CORS origins match Vercel domain(s)
- [ ] `.env` files not committed

## Manual security tests

- [ ] Non-admin JWT cannot access `/admin/finance`, `/admin/orders`, `/admin/reviews`
- [ ] Paymob webhook bad HMAC → 401
- [ ] Duplicate paid webhook → no double side effects
- [ ] Guest cannot earn wishlist points
- [ ] CSV cell with leading `=` exported safely

## Remaining risks

| Risk | Note |
|------|------|
| Product admin `any` bodies | Admin-only; typed DTOs recommended later |
| `create_order_with_inventory` not in repo | Verify in Supabase SQL |
| Public review submit | No CAPTCHA; moderation + 10/min throttle |
| Admin orders capped at 2000 | Add pagination when volume grows |
| Base RLS in dashboard | Verify with SQL queries in DATABASE_NOTES |

See also `AUTH_AND_PERMISSIONS.md`, `DATABASE_NOTES.md`.
