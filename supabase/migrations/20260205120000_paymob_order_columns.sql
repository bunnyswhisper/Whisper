-- Paymob payment metadata (run in Supabase SQL editor if migrations are not applied automatically)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paymob_intention_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paymob_transaction_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paymob_order_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_failure_reason text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_raw_response jsonb;
