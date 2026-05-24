-- Booth/event QR discount metadata on orders (campaign tables assumed applied separately).
-- Safe if columns already exist from manual SQL.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_source text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS event_campaign_id uuid;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS event_discount_percent numeric;

COMMENT ON COLUMN public.orders.discount_source IS 'none | coupon | event';
COMMENT ON COLUMN public.orders.event_campaign_id IS 'event_qr_campaigns.id when discount_source = event';
COMMENT ON COLUMN public.orders.event_discount_percent IS 'Percent applied when discount_source = event';
