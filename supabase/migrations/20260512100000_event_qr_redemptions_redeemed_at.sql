-- Timestamp when a booth QR redemption row was created (claim / save for checkout).
ALTER TABLE public.event_qr_redemptions
ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;

COMMENT ON COLUMN public.event_qr_redemptions.redeemed_at IS 'When the visitor claimed this booth discount (first insert).';
