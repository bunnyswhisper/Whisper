# Database Notes — Bunny's Whisper

## Migration convention

```
supabase/migrations/YYYYMMDDHHMMSS_snake_case_description.sql
```

Apply new migrations in Supabase before deploying API features that depend on them.

## V1.1 new tables

### `customer_wishlists`

| Column | Notes |
|--------|-------|
| `user_id` | Supabase auth user UUID |
| `product_id` | FK → `products(id)` ON DELETE CASCADE |
| Unique | `(user_id, product_id)` |

### `customer_reward_events`

| Column | Notes |
|--------|-------|
| `user_id` | Auth user |
| `event_type` | e.g. `first_wishlist` |
| `points_awarded` | Points granted for this event |
| Unique | `(user_id, event_type)` — prevents duplicate rewards |

### `finance_entries`

Manual admin ledger: `type` (income|expense), `amount`, `category`, optional product/variant links.

## V1.1 RPC

### `toggle_wishlist_atomic(p_user_id, p_product_id)`

- Toggles wishlist row
- On add: attempts one-time `first_wishlist` reward (+100 points)
- Remove does not revoke points or reward event

## Core existing tables (reference)

| Table | Purpose |
|-------|---------|
| `products`, `product_variants`, `product_images` | Catalog |
| `orders`, `order_items` | Orders |
| `customer_profiles`, `customer_points`, `customer_coupons` | Customers / loyalty |
| `customer_reviews` | Reviews |
| `event_qr_campaigns`, `event_qr_redemptions` | Booth QR |
| `order_email_events` | Email deduplication |
| `point_claim_codes` | Promo point codes |

## RLS

Base RLS policies for core tables may be managed in Supabase dashboard (not fully in repo). The API uses **service role** for all business logic. The web client only touches `customer_profiles` and storage directly.

### V1.1 hardening migration (`20260526120000`)

- Enables RLS + `FORCE ROW LEVEL SECURITY` on `finance_entries`, `customer_wishlists`, `customer_reward_events`
- `REVOKE ALL` from `anon` and `authenticated` on those tables
- API (service role) remains the only access path for wishlist/finance/rewards

### Verify in Supabase SQL editor

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('finance_entries', 'customer_wishlists', 'customer_reward_events', 'orders', 'customer_profiles');

SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'products' AND indexdef LIKE '%slug%';
```

## Performance indexes (migration `20260526120000`)

Adds `IF NOT EXISTS` indexes on: `products.slug`, `product_variants.product_id`, `product_images.product_id`, `orders.user_id`, `orders.created_at`, `orders.status`, `orders.payment_status`, `orders.paymob_order_id`, `order_items.order_id`, `customer_reviews.order_id`, `finance_entries.variant_id`.

## Important RPCs (pre-existing)

- `create_order_with_inventory`
- `claim_order_points_safe`
- `claim_point_code_atomic`
- `redeem_points_coupon_atomic`

**Do not modify these without full regression testing of checkout and points.**
