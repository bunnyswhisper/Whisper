/**
 * Normalizes NEXT_PUBLIC_SITE_URL so OAuth redirects never become `http://host//auth/callback`.
 */
export function normalizePublicSiteUrl(raw: string): string {
  const t = raw.trim().replace(/\/+$/, '');
  return t || 'http://localhost:3000';
}

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Public site origin for OAuth, emails, and absolute links. Must match Supabase “Redirect URLs”. */
export const SITE_URL = normalizePublicSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
);

/** Exact path Supabase redirects to after Google (and similar) OAuth. */
export const AUTH_CALLBACK_PATH = '/auth/callback';

export function apiUrl(path: string) {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function siteUrl(path: string) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${p}`;
}

/**
 * Full redirect URL passed to `signInWithOAuth({ options: { redirectTo } })`.
 * Always `${NEXT_PUBLIC_SITE_URL}/auth/callback?redirect=…` — never `window.location.origin`.
 */
export function authOAuthRedirectUrl(redirectAfterLogin: string): string {
  const path = redirectAfterLogin.startsWith('/')
    ? redirectAfterLogin
    : `/${redirectAfterLogin}`;
  const qs = new URLSearchParams({ redirect: path });
  return `${SITE_URL}${AUTH_CALLBACK_PATH}?${qs.toString()}`;
}

export function authPasswordResetRedirectUrl(): string {
  return siteUrl('/reset-password');
}

/** After login, only allow same-origin relative paths (blocks open redirects). */
export function safeAuthRedirectPath(raw: string | null): string {
  const fallback = '/';
  if (!raw || typeof raw !== 'string') return fallback;
  const t = raw.trim();
  if (!t.startsWith('/')) return fallback;
  if (t.startsWith('//')) return fallback;
  if (t.includes('://')) return fallback;
  return t;
}

/**
 * True when the browser is not on localhost but SITE_URL still points at localhost —
 * Google OAuth would return to localhost and fail on a phone.
 */
export function isOAuthSiteUrlLikelyWrongForCurrentHost(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const siteHost = new URL(SITE_URL).hostname;
    const pageHost = window.location.hostname;
    const siteIsLoopback =
      siteHost === 'localhost' || siteHost === '127.0.0.1';
    const pageIsLoopback =
      pageHost === 'localhost' || pageHost === '127.0.0.1';
    return siteIsLoopback && !pageIsLoopback;
  } catch {
    return false;
  }
}
