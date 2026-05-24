/** UI-only labels and step mapping. Backend values stay pending | confirmed | shipped | delivered | cancelled. */

export function customerOrderStatusLabel(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'pending' || s === 'confirmed') return 'Placed';
  if (s === 'shipped') return 'Shipped';
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'Cancelled';
  return status;
}

/** 0 = Placed, 1 = Shipped, 2 = Delivered. Null when cancelled (use separate UI). */
export function customerTrackingActiveStepIndex(status: string): number | null {
  const s = String(status || '').toLowerCase();
  if (s === 'cancelled') return null;
  if (s === 'pending' || s === 'confirmed') return 0;
  if (s === 'shipped') return 1;
  if (s === 'delivered') return 2;
  return 0;
}

export const CUSTOMER_TRACKING_STEPS = [
  {
    title: 'Placed',
    blurb: 'We received your order.',
  },
  {
    title: 'Shipped',
    blurb: 'Your package is on the way.',
  },
  {
    title: 'Delivered',
    blurb: 'Order completed.',
  },
] as const;

export type AdminOrderStatusAction = {
  label: string;
  /** Value sent to PATCH /admin/orders/:id/status */
  apiStatus: string;
  highlightKey: 'placed' | 'shipped' | 'delivered' | 'cancelled';
};

export const ADMIN_ORDER_STATUS_ACTIONS: AdminOrderStatusAction[] = [
  { label: 'Placed', apiStatus: 'confirmed', highlightKey: 'placed' },
  { label: 'Shipped', apiStatus: 'shipped', highlightKey: 'shipped' },
  { label: 'Delivered', apiStatus: 'delivered', highlightKey: 'delivered' },
  { label: 'Cancelled', apiStatus: 'cancelled', highlightKey: 'cancelled' },
];

export function adminPrimaryHighlightKey(
  orderStatus: string,
): AdminOrderStatusAction['highlightKey'] | null {
  const s = String(orderStatus || '').toLowerCase();
  if (s === 'pending' || s === 'confirmed') return 'placed';
  if (s === 'shipped') return 'shipped';
  if (s === 'delivered') return 'delivered';
  if (s === 'cancelled') return 'cancelled';
  return null;
}

export function adminStatusActionBorder(highlightKey: AdminOrderStatusAction['highlightKey']): string {
  switch (highlightKey) {
    case 'placed':
      return 'border-purple-400/40';
    case 'shipped':
      return 'border-blue-300/35';
    case 'delivered':
      return 'border-green-300/35';
    case 'cancelled':
      return 'border-red-300/35';
    default:
      return 'border-purple-950';
  }
}

/** Filled style for the action matching current backend phase. */
export function adminStatusActionHighlightClass(
  highlightKey: AdminOrderStatusAction['highlightKey'],
): string {
  switch (highlightKey) {
    case 'placed':
      return 'border-purple-300 bg-purple-300/15 text-white shadow-[0_0_25px_rgba(168,85,247,0.25)]';
    case 'shipped':
      return 'border-blue-300 bg-blue-400/15 text-white shadow-[0_0_22px_rgba(96,165,250,0.25)]';
    case 'delivered':
      return 'border-green-300 bg-green-400/15 text-white shadow-[0_0_22px_rgba(74,222,128,0.2)]';
    case 'cancelled':
      return 'border-red-300 bg-red-400/15 text-white shadow-[0_0_22px_rgba(248,113,113,0.2)]';
  }
}

export function isAdminStatusActionDisabled(
  orderStatus: string,
  apiStatus: string,
  isUpdating: boolean,
): boolean {
  if (isUpdating) return true;
  if (apiStatus === 'confirmed') return orderStatus === 'confirmed';
  return orderStatus === apiStatus;
}
