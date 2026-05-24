'use client';

import { supabase } from '@/lib/supabaseClient';

export type FreshSessionResult = {
  token: string | null;
  userId: string | null;
};

function isStaleRefreshError(error: unknown): boolean {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error ?? '');
  return /refresh token/i.test(msg) || /invalid.*session/i.test(msg);
}

/** Clears broken local sessions without surfacing AuthApiError overlays. */
export async function clearStaleAuthSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // ignore
  }
}

/**
 * Returns the current session, or null if missing / refresh token is invalid.
 */
export async function getSafeSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && isStaleRefreshError(error)) {
      await clearStaleAuthSession();
      return null;
    }
    return data.session ?? null;
  } catch (err) {
    if (isStaleRefreshError(err)) {
      await clearStaleAuthSession();
    }
    return null;
  }
}

export async function getFreshSessionToken(): Promise<FreshSessionResult> {
  const session = await getSafeSession();

  return {
    token: session?.access_token ?? null,
    userId: session?.user?.id ?? null,
  };
}

/**
 * Waits until Supabase exposes a session (e.g. right after login redirect).
 */
export async function waitForAuthSession(
  maxWaitMs = 8000,
): Promise<FreshSessionResult> {
  const immediate = await getFreshSessionToken();
  if (immediate.token) return immediate;

  return new Promise((resolve) => {
    let settled = false;

    const finish = async () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
      resolve(await getFreshSessionToken());
    };

    const timeout = setTimeout(() => {
      void finish();
    }, maxWaitMs);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        void finish();
      }
    });
  });
}

/**
 * Customer-facing pages should refetch only when auth identity/session meaningfully changes.
 * Skip INITIAL_SESSION (handled by mount), TOKEN_REFRESHED (same user), tab-focus churn, etc.
 */
export function shouldRefetchCustomerDataOnAuthEvent(event: string): boolean {
  return (
    event === 'SIGNED_IN' ||
    event === 'SIGNED_OUT' ||
    event === 'USER_UPDATED'
  );
}
