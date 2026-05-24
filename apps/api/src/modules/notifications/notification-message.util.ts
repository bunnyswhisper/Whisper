import type { AdminOrderNotificationInput } from './admin-order-notification.types';

export function orderItemsCount(order: AdminOrderNotificationInput): number {
  const items = order.order_items;
  if (!Array.isArray(items)) return 0;
  return items.reduce((s, i) => s + Number(i.quantity ?? 0), 0);
}

export function formatLocation(order: AdminOrderNotificationInput): string {
  const parts = [
    String(order.city || '').trim(),
    String(order.area || '').trim(),
  ].filter(Boolean);
  return parts.join(', ') || '—';
}

export function formatOrderStatusLabel(status: unknown): string {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'pending') return 'Placed';
  if (s === 'confirmed') return 'Confirmed';
  if (s === 'shipped') return 'Shipped';
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'Cancelled';
  return String(status || '—');
}

/** Admin Telegram: COD new orders read as “Placed” per product copy. */
export function formatAdminOrderStatusForTelegram(
  order: AdminOrderNotificationInput,
): string {
  const method = String(order.payment_method || '').toLowerCase();
  const st = String(order.status || '').toLowerCase().trim();
  if (method === 'cash_on_delivery' && (st === 'pending' || st === 'confirmed')) {
    return 'Placed';
  }
  return formatOrderStatusLabel(order.status);
}

export function formatAdminPaymentLabel(order: AdminOrderNotificationInput): string {
  const method = String(order.payment_method || '').toLowerCase();
  const ps = String(order.payment_status || '').toLowerCase();
  if (method === 'paymob' && ps === 'paid') {
    return 'Paid securely by card';
  }
  if (method === 'cash_on_delivery') {
    return 'Cash on delivery';
  }
  if (method === 'paymob') {
    return 'Card (pending)';
  }
  return order.payment_method ? String(order.payment_method) : '—';
}

/** Short payment line for admin Telegram (matches product copy). */
export function formatAdminTelegramPaymentLine(
  order: AdminOrderNotificationInput,
): string {
  const method = String(order.payment_method || '').toLowerCase();
  const ps = String(order.payment_status || '').toLowerCase();
  if (method === 'paymob' && ps === 'paid') {
    return 'Paid by card';
  }
  if (method === 'cash_on_delivery') {
    return 'Cash on delivery';
  }
  if (method === 'paymob') {
    return 'Card (pending)';
  }
  return order.payment_method ? String(order.payment_method) : '—';
}

/** Street, area, city — same order as checkout address lines. */
export function formatAdminOrderAddressLine(
  order: AdminOrderNotificationInput,
): string {
  const parts = [
    String(order.street || '').trim(),
    String(order.area || '').trim(),
    String(order.city || '').trim(),
  ].filter(Boolean);
  return parts.join(', ') || '—';
}

/**
 * Escape text for Telegram HTML parse mode (text nodes only).
 * @see https://core.telegram.org/bots/api#html-style
 */
export function escapeTelegramHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape a URL for Telegram HTML inside a double-quoted `href` attribute.
 * Only `& " < >` — do not over-escape paths so the link stays valid.
 * @see https://core.telegram.org/bots/api#html-style
 */
export function escapeTelegramAnchorHref(url: string): string {
  return String(url)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Admin new-order Telegram message (HTML). Caller supplies manage URL (no secrets).
 */
export function buildAdminNewOrderTelegramHtmlMessage(
  order: AdminOrderNotificationInput,
  manageUrl: string,
): string {
  const nameRaw = String(order.customer_name || '').trim() || 'Customer';
  const paymentRaw = formatAdminTelegramPaymentLine(order);
  const total = Number(order.total ?? 0);
  const totalRaw = `EGP ${total.toFixed(2)}`;
  const itemsCount = orderItemsCount(order);
  const addressRaw = formatAdminOrderAddressLine(order);

  const name = escapeTelegramHtml(nameRaw);
  const payment = escapeTelegramHtml(paymentRaw);
  const totalEsc = escapeTelegramHtml(totalRaw);
  const itemsEsc = escapeTelegramHtml(String(itemsCount));
  const address = escapeTelegramHtml(addressRaw);

  const hrefEsc = escapeTelegramAnchorHref(manageUrl);
  const adminLinkPlain = escapeTelegramHtml(manageUrl);

  return [
    `🛍 New Bunny's Whisper Order`,
    '',
    `Customer: ${name}`,
    `Payment: ${payment}`,
    `Total: ${totalEsc}`,
    `Items: ${itemsEsc}`,
    `Address: ${address}`,
    '',
    `👉 <a href="${hrefEsc}">Click here to manage</a>`,
    `Admin link: ${adminLinkPlain}`,
  ].join('\n');
}
