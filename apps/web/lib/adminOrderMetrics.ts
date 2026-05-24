/**
 * Canonical admin dashboard order metrics (analytics + orders pages).
 * Uses stored order.total when present, else recomputes from line items/fees.
 */

export type AdminOrderRow = {
  id?: string;
  total?: number | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  discount_amount?: number | null;
  vat_amount?: number | null;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  created_at?: string;
  customer_name?: string | null;
  customer_email?: string | null;
  city?: string | null;
  coupon_code?: string | null;
  discount_source?: string | null;
  order_items?: {
    product_name: string;
    size: string;
    color: string;
    quantity: number;
  }[];
};

export function normalizeOrderStatus(status: unknown): string {
  return String(status || '')
    .toLowerCase()
    .trim();
}

export function normalizePaymentStatus(status: unknown): string {
  return String(status || '')
    .toLowerCase()
    .trim();
}

export function normalizePaymentMethod(method: unknown): string {
  return String(method || '')
    .toLowerCase()
    .trim();
}

export function isNonCancelledOrder(order: AdminOrderRow): boolean {
  return normalizeOrderStatus(order.status) !== 'cancelled';
}

export function getAdminOrderTotal(order: AdminOrderRow): number {
  const subtotal = Number(order.subtotal || 0);
  const deliveryFee = Number(order.delivery_fee ?? subtotal * 0.12);
  const discount = Number(order.discount_amount || 0);
  const vat = Number(order.vat_amount || 0);
  const calculatedTotal = subtotal + deliveryFee + (vat > 0 ? vat : 0) - discount;

  return Number(order.total || 0) > 0
    ? Number(order.total)
    : Math.max(Number(calculatedTotal.toFixed(2)), 0);
}

/** Paid revenue: non-cancelled and payment_status = paid. */
export function countsAsPaidRevenue(order: AdminOrderRow): boolean {
  return (
    isNonCancelledOrder(order) &&
    normalizePaymentStatus(order.payment_status) === 'paid'
  );
}

export function countsAsDeliveredValue(order: AdminOrderRow): boolean {
  return normalizeOrderStatus(order.status) === 'delivered';
}

/** Pipeline value still open (not paid/failed/expired). */
export function countsAsPendingOrderValue(order: AdminOrderRow): boolean {
  if (!isNonCancelledOrder(order)) return false;

  const payment = normalizePaymentStatus(order.payment_status);
  if (payment === 'paid' || payment === 'failed' || payment === 'expired') {
    return false;
  }

  const status = normalizeOrderStatus(order.status);
  if (status === 'pending' || status === 'confirmed' || status === 'shipped') {
    return true;
  }

  return payment === 'pending' || payment === 'unpaid';
}

export function countsAsCodOutstanding(order: AdminOrderRow): boolean {
  return (
    isNonCancelledOrder(order) &&
    normalizePaymentMethod(order.payment_method) === 'cash_on_delivery' &&
    normalizePaymentStatus(order.payment_status) === 'unpaid'
  );
}

export function countsAsFailedPayment(order: AdminOrderRow): boolean {
  return normalizePaymentStatus(order.payment_status) === 'failed';
}

export function countsAsExpiredPayment(order: AdminOrderRow): boolean {
  return normalizePaymentStatus(order.payment_status) === 'expired';
}

export function countsAsFailedExpiredPayment(order: AdminOrderRow): boolean {
  return countsAsFailedPayment(order) || countsAsExpiredPayment(order);
}

export type AdminOrderRollups = {
  grossOrderValue: number;
  paidRevenue: number;
  deliveredRevenue: number;
  pendingOrderValue: number;
  codOutstandingCount: number;
  codOutstandingValue: number;
  failedExpiredPaymentsCount: number;
  failedPaymentsCount: number;
  expiredPaymentsCount: number;
  failedExpiredPaymentsValue: number;
  nonCancelledOrderCount: number;
  avgOrderValue: number;
};

export function computeAdminOrderRollups(orders: AdminOrderRow[]): AdminOrderRollups {
  const active = orders.filter(isNonCancelledOrder);

  const grossOrderValue = active.reduce(
    (sum, order) => sum + getAdminOrderTotal(order),
    0,
  );

  const paidRevenue = active
    .filter(countsAsPaidRevenue)
    .reduce((sum, order) => sum + getAdminOrderTotal(order), 0);

  const deliveredRevenue = orders
    .filter(countsAsDeliveredValue)
    .reduce((sum, order) => sum + getAdminOrderTotal(order), 0);

  const pendingOrderValue = active
    .filter(countsAsPendingOrderValue)
    .reduce((sum, order) => sum + getAdminOrderTotal(order), 0);

  const codOrders = active.filter(countsAsCodOutstanding);
  const codOutstandingValue = codOrders.reduce(
    (sum, order) => sum + getAdminOrderTotal(order),
    0,
  );

  const failedPaymentOrders = orders.filter(countsAsFailedPayment);
  const expiredPaymentOrders = orders.filter(countsAsExpiredPayment);
  const failedPaymentsCount = failedPaymentOrders.length;
  const expiredPaymentsCount = expiredPaymentOrders.length;
  const failedExpiredPaymentsCount = failedPaymentsCount + expiredPaymentsCount;
  const failedExpiredPaymentsValue = [...failedPaymentOrders, ...expiredPaymentOrders].reduce(
    (sum, order) => sum + getAdminOrderTotal(order),
    0,
  );

  const nonCancelledOrderCount = active.length;
  const avgOrderValue =
    nonCancelledOrderCount > 0 ? grossOrderValue / nonCancelledOrderCount : 0;

  return {
    grossOrderValue,
    paidRevenue,
    deliveredRevenue,
    pendingOrderValue,
    codOutstandingCount: codOrders.length,
    codOutstandingValue,
    failedExpiredPaymentsCount,
    failedPaymentsCount,
    expiredPaymentsCount,
    failedExpiredPaymentsValue,
    nonCancelledOrderCount,
    avgOrderValue,
  };
}
