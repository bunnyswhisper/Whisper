-- Admin cancellation reason + order_cancelled email type
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS admin_cancellation_reason text;

ALTER TABLE public.order_email_events
  DROP CONSTRAINT IF EXISTS order_email_events_email_type_check;

ALTER TABLE public.order_email_events
  ADD CONSTRAINT order_email_events_email_type_check
  CHECK (
    email_type IN (
      'cod_confirmation',
      'paymob_paid_confirmation',
      'order_shipped',
      'order_delivered',
      'order_cancelled'
    )
  );
