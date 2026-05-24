export type OrderEmailType =
  | 'cod_confirmation'
  | 'paymob_paid_confirmation'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled';

export type OrderEmailOrderRow = {
  id?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  total?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  review_token_hash?: string | null;
  admin_cancellation_reason?: string | null;
  return_reason?: string | null;
};
