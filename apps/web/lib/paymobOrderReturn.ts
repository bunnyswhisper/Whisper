import { apiUrl } from '@/lib/api';
import { ensureCustomerBootstrap } from '@/lib/authBootstrap';
import { waitForAuthSession } from '@/lib/authSession';
import { supabase } from '@/lib/supabaseClient';

export type PaymobReturnOrder = Record<string, unknown>;

export type PaymobReturnFetchResult =
  | { ok: true; order: PaymobReturnOrder; status: number }
  | {
      ok: false;
      kind: 'auth' | 'not_found' | 'error';
      message: string;
      status: number;
    };

function parseApiMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as { message?: unknown };
  if (typeof record.message === 'string') return record.message;
  if (Array.isArray(record.message)) {
    return record.message.filter((m) => typeof m === 'string').join(', ');
  }
  return '';
}

export type PaymobFinalizeResult =
  | {
      ok: true;
      finalized: boolean;
      alreadyPaid?: boolean;
      newlyFinalized?: boolean;
      paymobVerified?: boolean;
      telegramSent?: boolean;
      telegramAttempted?: boolean;
      paymentStatusBefore?: string;
      paymentStatusAfter?: string;
      awaitingConfirmation?: boolean;
      order?: PaymobReturnOrder;
    }
  | { ok: false; status: number; message: string };

/** Mirror backend: Paymob redirect uses dotted keys (`source_data.pan`, `data.message`). */
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

/** Paymob redirect query params (everything except our internal orderId). */
export function collectPaymobRedirectCallback(
  searchParams: URLSearchParams,
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key === 'orderId') return;
    out[key] = value;
  });
  return Object.keys(out).length > 0 ? normalizePaymobRedirectParams(out) : undefined;
}

export async function requestPaymobOrderFinalization(
  orderId: string,
  token: string,
  redirectCallback?: Record<string, string>,
): Promise<PaymobFinalizeResult> {
  const url = apiUrl('/payments/paymob/finalize-order');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, redirectCallback }),
      cache: 'no-store',
    });

    const raw = await res.text();
    let body: Record<string, unknown> = {};
    if (raw) {
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const message = parseApiMessage(body);

    if (!res.ok) {
      return { ok: false, status: res.status, message: message || 'Finalize failed' };
    }

    return {
      ok: true,
      finalized: Boolean(body.finalized),
      alreadyPaid: body.alreadyPaid as boolean | undefined,
      newlyFinalized: body.newlyFinalized as boolean | undefined,
      paymobVerified: body.paymobVerified as boolean | undefined,
      awaitingConfirmation: body.awaitingConfirmation as boolean | undefined,
      order: (body.order as PaymobReturnOrder) ?? undefined,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Network error while finalizing payment.';
    return { ok: false, status: 0, message };
  }
}

function classifyOrderFetchFailure(
  status: number,
  message: string,
): PaymobReturnFetchResult {
  const normalized = message.trim().toLowerCase();

  if (status === 401) {
    if (
      normalized.includes('invalid customer token') ||
      normalized.includes('missing customer token')
    ) {
      return {
        ok: false,
        kind: 'auth',
        message: 'Please sign in to view this order.',
        status,
      };
    }
    return {
      ok: false,
      kind: 'auth',
      message: 'Please sign in to view this order.',
      status,
    };
  }

  if (status === 404 || (status === 400 && normalized.includes('order not found'))) {
    return {
      ok: false,
      kind: 'not_found',
      message: 'Order not found.',
      status,
    };
  }

  return {
    ok: false,
    kind: 'error',
    message: message || 'Could not load this order.',
    status,
  };
}

export async function fetchCustomerOrderForPaymobReturn(
  orderId: string,
  token: string,
): Promise<PaymobReturnFetchResult> {
  const url = apiUrl(`/customer/orders/${orderId}`);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    const raw = await res.text();
    let body: unknown = null;
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = raw;
      }
    }

    if (res.ok) {
      return { ok: true, order: (body ?? {}) as PaymobReturnOrder, status: res.status };
    }

    return classifyOrderFetchFailure(res.status, parseApiMessage(body));
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Network error while loading your order.';
    return { ok: false, kind: 'error', message, status: 0 };
  }
}

/**
 * Waits for Supabase session after external Paymob redirect, bootstraps customer, fetches order.
 */
export async function loadOrderAfterPaymobReturn(
  orderId: string,
  redirectCallback?: Record<string, string>,
): Promise<PaymobReturnFetchResult> {
  const session = await waitForAuthSession(12_000);

  if (!session.token) {
    return {
      ok: false,
      kind: 'auth',
      message: 'Please sign in to view this order.',
      status: 401,
    };
  }

  await ensureCustomerBootstrap(supabase);

  const finalizeResult = await requestPaymobOrderFinalization(
    orderId,
    session.token,
    redirectCallback,
  );

  const paymentStatusAfterFinalize =
    finalizeResult.ok && finalizeResult.order
      ? String(finalizeResult.order.payment_status ?? '')
      : null;

  let result = await fetchCustomerOrderForPaymobReturn(orderId, session.token);

  if (
    finalizeResult.ok &&
    finalizeResult.finalized &&
    finalizeResult.order &&
    paymentStatusAfterFinalize === 'paid'
  ) {
    result = {
      ok: true,
      order: finalizeResult.order as PaymobReturnOrder,
      status: 200,
    };
  }

  if (!result.ok && result.kind === 'auth') {
    const retrySession = await waitForAuthSession(4_000);
    if (retrySession.token && retrySession.token !== session.token) {
      result = await fetchCustomerOrderForPaymobReturn(orderId, retrySession.token);
    }
  }

  return result;
}
