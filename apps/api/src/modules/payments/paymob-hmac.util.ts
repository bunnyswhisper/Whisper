import * as crypto from 'crypto';

/**
 * Paymob TRANSACTION (Processed) POST callback HMAC (SHA-512).
 * @see https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac-transaction-callback
 */
export function verifyPaymobTransactionHmac(
  transactionObj: Record<string, unknown>,
  receivedHmac: string | undefined,
  secret: string,
): boolean {
  if (!receivedHmac || !secret || !transactionObj) return false;

  const obj = transactionObj;
  const order = (obj.order as Record<string, unknown>) || {};
  const sd = (obj.source_data as Record<string, unknown>) || {};

  const parts = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    order.id,
    obj.owner,
    obj.pending,
    sd.pan,
    sd.sub_type,
    sd.type,
    obj.success,
  ];

  const concatenated = parts
    .map((v) => (v === undefined || v === null ? '' : String(v)))
    .join('');

  const expectedHex = crypto
    .createHmac('sha512', secret)
    .update(concatenated)
    .digest('hex');

  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(String(receivedHmac).toLowerCase(), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Paymob browser redirect (GET) callback HMAC — same field order as transaction webhook.
 */
export function verifyPaymobRedirectHmac(
  params: Record<string, string>,
  receivedHmac: string | undefined,
  secret: string,
): boolean {
  if (!receivedHmac || !secret) return false;

  const p = normalizePaymobRedirectParams(params);

  const parts = [
    p.amount_cents,
    p.created_at,
    p.currency,
    p.error_occured,
    p.has_parent_transaction,
    p.id,
    p.integration_id,
    p.is_3d_secure,
    p.is_auth,
    p.is_capture,
    p.is_refunded,
    p.is_standalone_payment,
    p.is_voided,
    p.order,
    p.owner,
    p.pending,
    p.source_data_pan,
    p.source_data_sub_type,
    p.source_data_type,
    p.success,
  ];

  const concatenated = parts
    .map((v) => (v === undefined || v === null ? '' : String(v)))
    .join('');

  const expectedHex = crypto
    .createHmac('sha512', secret)
    .update(concatenated)
    .digest('hex');

  const a = Buffer.from(expectedHex, 'hex');
  const b = Buffer.from(String(receivedHmac).toLowerCase(), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Paymob redirect uses dotted query keys; normalize for HMAC + success checks. */
export function normalizePaymobRedirectParams(
  raw: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...raw };

  if (raw['source_data.pan'] && !out.source_data_pan) {
    out.source_data_pan = raw['source_data.pan'];
  }
  if (raw['source_data.sub_type'] && !out.source_data_sub_type) {
    out.source_data_sub_type = raw['source_data.sub_type'];
  }
  if (raw['source_data.type'] && !out.source_data_type) {
    out.source_data_type = raw['source_data.type'];
  }
  if (raw['data.message'] && !out.data_message) {
    out.data_message = raw['data.message'];
  }

  return out;
}

export function isPaymobRedirectPaymentSuccess(
  params: Record<string, string>,
): boolean {
  const normalized = normalizePaymobRedirectParams(params);

  const norm = (k: string) =>
    String(normalized[k] ?? '')
      .trim()
      .toLowerCase();

  const success = norm('success') === 'true';
  const pending = norm('pending') === 'true';
  const error = norm('error_occured') === 'true';
  const voided = norm('is_voided') === 'true';
  const refunded = norm('is_refunded') === 'true';
  const approved = String(normalized.data_message ?? '').trim() === 'Approved';

  if (approved) return true;

  return (
    success &&
    !pending &&
    !error &&
    norm('is_void') !== 'true' &&
    norm('is_refund') !== 'true' &&
    !voided &&
    !refunded
  );
}

/** Explicit Paymob redirect failure (not merely missing/awaiting confirmation). */
export function isPaymobRedirectPaymentFailure(
  params: Record<string, string>,
): boolean {
  const normalized = normalizePaymobRedirectParams(params);

  const norm = (k: string) =>
    String(normalized[k] ?? '')
      .trim()
      .toLowerCase();

  if (isPaymobRedirectPaymentSuccess(params)) return false;
  if (norm('pending') === 'true') return false;

  if (norm('error_occured') === 'true') return true;
  if (norm('success') === 'false') return true;
  if (norm('is_void') === 'true' || norm('is_voided') === 'true') return true;
  if (norm('is_refund') === 'true' || norm('is_refunded') === 'true') return true;

  const msg = String(normalized.data_message ?? '').trim().toLowerCase();
  if (msg && msg !== 'approved' && msg.includes('declin')) return true;

  return false;
}
