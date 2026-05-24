-- Reviews V2: moderation, admin replies, soft-delete
ALTER TABLE public.customer_reviews
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by text,
  ADD COLUMN IF NOT EXISTS admin_reply text,
  ADD COLUMN IF NOT EXISTS admin_reply_visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS admin_reply_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reply_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_reply_by text;

ALTER TABLE public.customer_reviews
  DROP CONSTRAINT IF EXISTS customer_reviews_admin_reply_visibility_check;

ALTER TABLE public.customer_reviews
  ADD CONSTRAINT customer_reviews_admin_reply_visibility_check
  CHECK (admin_reply_visibility IN ('public', 'private'));

CREATE INDEX IF NOT EXISTS customer_reviews_public_list_idx
  ON public.customer_reviews (created_at DESC)
  WHERE is_hidden = false AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customer_reviews_admin_state_idx
  ON public.customer_reviews (is_hidden, deleted_at, created_at DESC);
