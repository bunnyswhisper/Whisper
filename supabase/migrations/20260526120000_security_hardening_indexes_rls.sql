-- Production hardening: performance indexes + lock V1.1 tables from direct PostgREST access.
-- API uses service_role (bypasses RLS). Web wishlist/finance/rewards go through Nest API only.

-- ---------------------------------------------------------------------------
-- Indexes (IF NOT EXISTS — safe on existing production schemas)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_products_slug
  ON public.products (slug);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id
  ON public.product_variants (product_id);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
  ON public.product_images (product_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id
  ON public.orders (user_id);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
  ON public.orders (status);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status
  ON public.orders (payment_status);

CREATE INDEX IF NOT EXISTS idx_orders_paymob_order_id
  ON public.orders (paymob_order_id)
  WHERE paymob_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_customer_reviews_order_id
  ON public.customer_reviews (order_id);

CREATE INDEX IF NOT EXISTS idx_finance_entries_variant_id
  ON public.finance_entries (variant_id)
  WHERE variant_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS + revoke direct anon/authenticated access to sensitive V1.1 tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reward_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.finance_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wishlists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_reward_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.finance_entries FROM anon, authenticated;
REVOKE ALL ON public.customer_wishlists FROM anon, authenticated;
REVOKE ALL ON public.customer_reward_events FROM anon, authenticated;

COMMENT ON TABLE public.finance_entries IS
  'Admin ledger — API service_role only; direct PostgREST access revoked.';

COMMENT ON TABLE public.customer_wishlists IS
  'Customer wishlists — API service_role only; toggle via toggle_wishlist_atomic RPC.';

COMMENT ON TABLE public.customer_reward_events IS
  'Reward ledger — API service_role only; unique (user_id, event_type) prevents abuse.';
