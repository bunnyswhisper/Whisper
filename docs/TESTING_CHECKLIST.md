# Testing Checklist — Bunny's Whisper

## Pre-deploy

- [ ] Apply Supabase migrations through `20260526120000_security_hardening_indexes_rls.sql`
- [ ] `cd apps/api && npm run build`
- [ ] `cd apps/web && npm run build`
- [ ] Verify env vars on Render + Vercel (no secrets in git)

## Checkout / payments (regression — must pass)

- [ ] COD order completes; stock decrements
- [ ] Paymob card payment completes
- [ ] Order confirmation email sends
- [ ] Telegram notification fires (if configured)
- [ ] Admin sees new order

## Wishlist (V1.1)

- [ ] Guest clicking heart → redirect to login
- [ ] Logged-in: empty heart → filled purple heart on catalog + PDP
- [ ] Toggle off removes from wishlist
- [ ] `/account/wishlist` shows saved products
- [ ] First wishlist add shows centered reward modal: "Congrats, {name} ✦" + +100 Bunny Points badge
- [ ] Second product add: **no** extra points
- [ ] Remove + re-add same or different product: **no** extra points
- [ ] `/points` balance reflects +100 once
- [ ] Admin Analytics → Wishlist tab shows counts

### Reset first-wishlist reward (testing only)

To re-test the +100 Bunny points reward modal for an account that already received it, delete only that customer's `first_wishlist` reward row in Supabase (test data only — do not add a public reset UI):

```sql
DELETE FROM customer_reward_events
WHERE user_id = '<your-auth-user-uuid>'
  AND event_type = 'first_wishlist';
```

Then sign in as that customer and add a product to the wishlist again. The API must return `firstWishlistRewardGranted: true` for the modal to appear. Use a fresh customer account instead if you prefer not to touch production-like data.

## Finance (V1.1)

- [ ] Non-admin cannot access `/admin/finance`
- [ ] Dashboard shows Add Money / Subtract Money buttons
- [ ] Add Money flow at `/admin/finance/new?type=income` saves income
- [ ] Subtract Money flow at `/admin/finance/new?type=expense` saves expense
- [ ] Manufacturing expense supports product + all sizes or specific variant
- [ ] Period filters (week / month / last month) work on dashboard
- [ ] Reports at `/admin/finance/reports` show monthly + weekly breakdown
- [ ] CSV export works from reports page
- [ ] PDF button shows "PDF soon" (disabled)

## Reviews / auth / admin (smoke)

- [ ] Public `/reviews` loads and filters
- [ ] Admin review approve/hide still works
- [ ] Product admin edit still works
- [ ] Customer login / logout works

## Mobile

- [ ] Wishlist heart tappable on product cards
- [ ] Wishlist page layout clean on iPhone width
- [ ] PWA icon still correct after deploy

## Load / security smoke (pre-launch)

- [ ] ~50 concurrent homepage loads (catalog API + web)
- [ ] ~100 product detail page views
- [ ] ~100 wishlist toggles (logged-in) — no duplicate rewards
- [ ] ~50 checkout attempts (mix COD + Paymob test) — no duplicate orders from double-click
- [ ] Paymob webhook duplicate retry — order paid once only
- [ ] Review spam attempt (public submit) — throttled after ~10/min
- [ ] Admin dashboard under normal traffic — acceptable response times
- [ ] Monitor Render cold starts; Supabase connection usage

Optional tooling: k6 or autocannon against staging `GET /products` and `GET /health` only — do not load-test Paymob webhook in production.

See `docs/SECURITY_CHECKLIST.md` for full security test list.
