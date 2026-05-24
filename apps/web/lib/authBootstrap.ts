import type { SupabaseClient, User } from '@supabase/supabase-js';
import { API_URL, apiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import { waitForAuthSession } from '@/lib/authSession';

export type AuthBootstrapHints = {
  phone?: string | null;
  countryCode?: string;
};

export type BootstrapCustomerPayload = {
  ok: true;
  profile: Record<string, unknown> | null;
  points: Record<string, unknown> | null;
};

export type BootstrapResult =
  | BootstrapCustomerPayload
  | { ok: false; message: string; status?: number };

/** Dev-only logging; never throws; never uses console.error (avoids Next overlays). */
export function logAuthDev(
  scope: string,
  details: Record<string, unknown>,
  level: 'warn' | 'debug' = 'warn',
): void {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    const payload = { apiBase: API_URL, ...details };
    if (level === 'debug') {
      // eslint-disable-next-line no-console -- dev diagnostics only
      console.debug(`[auth] ${scope}`, payload);
    } else {
      // eslint-disable-next-line no-console -- recoverable auth issues
      console.warn(`[auth] ${scope}`, payload);
    }
  } catch {
    // never throw from logging
  }
}

function parseApiMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as { message?: unknown };
  if (typeof record.message === 'string') return record.message;
  if (Array.isArray(record.message)) {
    return record.message.filter((m) => typeof m === 'string').join(', ');
  }
  return '';
}

/** Same-token bootstrap skip + single flight — avoids duplicate POST spam from parallel fetches. */
let bootstrapInflight: Promise<BootstrapResult> | null = null;
let bootstrapInflightToken: string | null = null;
let lastBootstrapOkAccessToken: string | null = null;

async function postBootstrapCustomer(
  accessToken: string,
  hints?: AuthBootstrapHints,
): Promise<BootstrapResult> {
  const url = apiUrl('/auth/bootstrap-customer');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(hints ?? {}),
    });

    let body: unknown = null;
    const raw = await res.text();
    if (raw) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = raw;
      }
    }

    logAuthDev(
      'bootstrap-customer response',
      { url, hasToken: true, status: res.status, body },
      'debug',
    );

    if (!res.ok) {
      const message = parseApiMessage(body) || res.statusText || 'Bootstrap failed';
      logAuthDev('bootstrap-customer HTTP', { url, hasToken: true, status: res.status, body }, 'warn');
      return { ok: false, message, status: res.status };
    }

    const parsed = (body ?? {}) as {
      ok?: boolean;
      profile?: Record<string, unknown> | null;
      points?: Record<string, unknown> | null;
    };

    return {
      ok: true,
      profile: parsed.profile ?? null,
      points: parsed.points ?? null,
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : 'Error';
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Network error — is the API running on NEXT_PUBLIC_API_URL?';
    logAuthDev('bootstrap-customer network', { url, hasToken: true, name, message }, 'warn');
    return { ok: false, message };
  }
}

/**
 * Ensures customer_profiles + customer_points via API (service role on server).
 * Never inserts customer_points from the browser — avoids RLS 403.
 */
export async function ensureCustomerBootstrap(
  client: SupabaseClient,
  _user?: User,
  hints?: AuthBootstrapHints,
): Promise<BootstrapResult> {
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();

  if (sessionError) {
    return { ok: false, message: sessionError.message };
  }

  const accessToken = session?.access_token;
  const hasToken = Boolean(accessToken);
  const url = apiUrl('/auth/bootstrap-customer');

  if (!accessToken) {
    logAuthDev('bootstrap-customer skipped', { url, hasToken: false }, 'debug');
    return { ok: false, message: 'No active session' };
  }

  if (lastBootstrapOkAccessToken === accessToken) {
    logAuthDev('bootstrap-customer skipped', { hasToken: true, reason: 'already_ok' }, 'debug');
    return { ok: true, profile: null, points: null };
  }

  if (bootstrapInflight && bootstrapInflightToken === accessToken) {
    const shared = await bootstrapInflight;
    if (shared.ok && 'profile' in shared) {
      lastBootstrapOkAccessToken = accessToken;
    }
    return shared;
  }

  if (bootstrapInflight && bootstrapInflightToken !== accessToken) {
    await bootstrapInflight;
  }

  if (!bootstrapInflight) {
    bootstrapInflightToken = accessToken;
    bootstrapInflight = postBootstrapCustomer(accessToken, hints).finally(() => {
      bootstrapInflight = null;
      bootstrapInflightToken = null;
    });
  }

  const result = await bootstrapInflight;
  if (result.ok && 'profile' in result) {
    lastBootstrapOkAccessToken = accessToken;
  }

  return result;
}

export type AuthenticatedJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; authRequired?: boolean };

type FetchAttempt = {
  ok: boolean;
  status: number;
  data: unknown;
  message: string;
};

async function fetchJsonAuthenticated(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<FetchAttempt> {
  const url = apiUrl(path);
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const raw = await res.text();
    let data: unknown = null;
    if (raw) {
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        data = raw;
      }
    }

    if (res.ok) {
      return { ok: true, status: res.status, data, message: '' };
    }

    return {
      ok: false,
      status: res.status,
      data,
      message: parseApiMessage(data) || res.statusText || 'Request failed',
    };
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Network error — check your connection and API URL';
    logAuthDev(`${path} network`, { url, hasToken: true, message }, 'warn');
    return { ok: false, status: 0, data: null, message };
  }
}

/**
 * Waits for session, fetches JSON from API; on failure runs bootstrap once and retries once.
 */
export async function fetchJsonWithBootstrapRetry<T>(
  path: string,
  init?: RequestInit,
  accessToken?: string,
): Promise<AuthenticatedJsonResult<T>> {
  const session = accessToken
    ? { token: accessToken }
    : await waitForAuthSession();
  const hasToken = Boolean(session.token);

  if (!session.token) {
    logAuthDev(`${path} no session`, { hasToken: false }, 'debug');
    return { ok: false, message: 'Login required', authRequired: true };
  }

  let attempt = await fetchJsonAuthenticated(path, session.token, init);
  if (attempt.ok) {
    return { ok: true, data: attempt.data as T };
  }

  logAuthDev(`${path} first attempt failed`, {
    hasToken,
    status: attempt.status,
    message: attempt.message,
    body: attempt.data,
  }, 'warn');

  const boot = await ensureCustomerBootstrap(supabase);
  if (!boot.ok) {
    logAuthDev(`${path} bootstrap before retry`, {
      hasToken,
      message: boot.message,
      status: boot.status,
    }, 'warn');
  }

  attempt = await fetchJsonAuthenticated(path, session.token, init);
  if (attempt.ok) {
    return { ok: true, data: attempt.data as T };
  }

  logAuthDev(`${path} after retry`, {
    hasToken,
    status: attempt.status,
    message: attempt.message,
    body: attempt.data,
  }, 'warn');

  return { ok: false, message: attempt.message };
}
