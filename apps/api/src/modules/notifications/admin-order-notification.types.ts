/** Minimal order shape for admin Telegram / email summaries (no secrets). */
export type AdminOrderNotificationInput = {
  id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  total?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  city?: string | null;
  area?: string | null;
  street?: string | null;
  order_items?: { quantity?: number | null }[] | null;
};
