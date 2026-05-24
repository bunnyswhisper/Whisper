-- Optional contact email for public reviews (admin-only, never shown publicly)

ALTER TABLE public.customer_reviews
  ADD COLUMN IF NOT EXISTS reviewer_email text;
