/**
 * Maps Supabase / network auth errors to safe customer-facing copy.
 * Never returns raw technical messages for unknown failures.
 */
export function mapAuthError(message: string, code?: string): string {
  const m = message.toLowerCase();
  if (code === 'weak_password') {
    return 'Password is too weak. Use at least 6 characters, or choose a longer phrase.';
  }
  if (
    m.includes('redirect_uri') ||
    m.includes('redirect uri') ||
    m.includes('redirect url')
  ) {
    return 'Sign-in redirect URL does not match Supabase settings. Add NEXT_PUBLIC_SITE_URL (and /auth/callback) under Supabase → Authentication → URL Configuration → Redirect URLs.';
  }
  if (m.includes('access_denied') || m.includes('access denied')) {
    return 'Google sign-in was cancelled.';
  }
  if (
    m.includes('email not confirmed') ||
    m.includes('email_not_confirmed')
  ) {
    return 'Please confirm your email before signing in. Check your inbox for the confirmation link.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'This email is already in use. If you signed up with Google, use Google sign-in; otherwise try logging in or reset your password.';
  }
  if (m.includes('too many requests') || m.includes('rate limit') || m.includes('over_email_send_rate')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (m.includes('weak_password') || (m.includes('password') && m.includes('least'))) {
    return 'Password is too weak. Use at least 6 characters, or choose a longer phrase.';
  }
  if (m.includes('fetch') || m.includes('network') || m.includes('failed to fetch')) {
    return 'Network issue. Check your connection and try again.';
  }
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Invalid email or password. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function isInvalidLoginCredentials(message: string, code?: string): boolean {
  const m = message.toLowerCase();
  return (
    code === 'invalid_credentials' ||
    m.includes('invalid login credentials') ||
    m.includes('invalid credentials')
  );
}

export function isEmailNotConfirmed(message: string, code?: string): boolean {
  const m = message.toLowerCase();
  return code === 'email_not_confirmed' || m.includes('email not confirmed');
}

/** Safe message when OAuth callback must pass an error through the URL. */
export function friendlyOAuthCallbackError(
  raw: string,
  code?: string,
): string {
  return mapAuthError(raw, code);
}
