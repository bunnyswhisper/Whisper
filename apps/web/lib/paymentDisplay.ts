export function paymentMethodLabel(raw: string | null | undefined): string {
  const method = String(raw || '').toLowerCase();
  if (method === 'paymob') return 'Card payment';
  if (method === 'cash_on_delivery') return 'Cash on delivery';
  return raw ? String(raw) : '—';
}

export function paymentStatusLabel(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined,
): string {
  const method = String(paymentMethod || '').toLowerCase();
  const status = String(paymentStatus || '').toLowerCase();

  if (method === 'paymob' && status === 'expired') return 'Payment not completed';
  if (method === 'paymob' && status === 'failed') return 'Card payment failed';
  if (method === 'paymob' && status === 'paid') return 'Paid securely by card';
  if (method === 'paymob' && status === 'pending') return 'Payment is being verified';
  if (status === 'failed') return 'Payment failed';
  if (
    method === 'cash_on_delivery' &&
    (status === 'unpaid' || status === 'pending')
  ) {
    return 'Cash on delivery';
  }
  if (status === 'paid') return 'Paid securely by card';
  return paymentStatus ? String(paymentStatus) : '—';
}

/** Admin UI / exports: Paymob-aware + cancelled + pending clarity. DB values unchanged. */
export function adminPaymentStatusLabel(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined,
  orderStatus?: string | null | undefined,
): string {
  const method = String(paymentMethod || '').toLowerCase();
  const status = String(paymentStatus || '').toLowerCase();
  const ord = String(orderStatus || '').toLowerCase();

  if (ord === 'cancelled') {
    const paymentNotCompleted =
      (method === 'paymob' &&
        (status === 'pending' ||
          status === 'failed' ||
          status === 'expired')) ||
      (method === 'cash_on_delivery' &&
        (status === 'unpaid' || status === 'pending'));
    if (paymentNotCompleted) {
      return 'Order cancelled — payment not completed';
    }
  }

  if (method === 'paymob') {
    if (status === 'pending') return 'Card payment not completed / pending';
    if (status === 'paid') return 'Paid by card';
    if (status === 'failed') return 'Card payment failed';
    if (status === 'expired') return 'Payment session expired';
  }

  return paymentStatusLabel(paymentMethod, paymentStatus);
}
