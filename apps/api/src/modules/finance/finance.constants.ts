export const FINANCE_CATEGORIES = [
  'Products / Manufacturing',
  'Packaging',
  'QR Cards',
  'Boxes',
  'Cards',
  'Software Subscriptions',
  'Marketing',
  'Shipping / Delivery',
  'Refunds / Returns',
  'Other',
] as const;

export type FinanceCategory = (typeof FINANCE_CATEGORIES)[number];
