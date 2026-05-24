-- Public review submission + pending approval (Reviews V2 augment)

ALTER TABLE public.customer_reviews
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.customer_reviews
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'order_token',
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS public_product_name text;

ALTER TABLE public.customer_reviews
  DROP CONSTRAINT IF EXISTS customer_reviews_source_check;

ALTER TABLE public.customer_reviews
  ADD CONSTRAINT customer_reviews_source_check
  CHECK (source IN ('order_token', 'public'));

UPDATE public.customer_reviews
SET
  source = 'order_token',
  is_approved = true,
  approved_at = COALESCE(approved_at, created_at)
WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS customer_reviews_public_pending_idx
  ON public.customer_reviews (created_at DESC)
  WHERE source = 'public' AND is_approved = false AND deleted_at IS NULL;
