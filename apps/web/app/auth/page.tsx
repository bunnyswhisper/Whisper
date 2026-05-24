'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';
import BrandLoader from '@/components/BrandLoader';
import Navbar from '@/components/Navbar';
import {
  authOAuthRedirectUrl,
  isOAuthSiteUrlLikelyWrongForCurrentHost,
  safeAuthRedirectPath,
} from '@/lib/api';
import {
  isEmailNotConfirmed,
  isInvalidLoginCredentials,
  mapAuthError,
} from '@/lib/authErrors';
import { ensureCustomerBootstrap, logAuthDev } from '@/lib/authBootstrap';
import { supabase } from '@/lib/supabaseClient';
import { interactivePressable } from '@/lib/interactivePressable';

const INVALID_PASSWORD_LOGIN_MESSAGE =
  'This email/password combination was not found. If you usually use Google, continue with Google or create a password account.';

const SIGNUP_EMAIL_IN_USE_MESSAGE =
  'This email is already in use — often because you signed up with Google. Use Continue with Google below, or switch to Login. If you already use a password for this store, open Login and try Forgot password.';

const INPUT_CLASS =
  'min-h-[44px] w-full rounded-xl border border-solid border-purple-950 bg-[#07030d] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)] disabled:opacity-60';

const PASSWORD_INPUT_CLASS = `${INPUT_CLASS} text-left [direction:ltr]`;

function basicEmailOk(value: string): boolean {
  const t = value.trim();
  return t.includes('@') && t.length >= 5 && !t.includes(' ');
}

function runCustomerBootstrapInBackground(user: User) {
  void ensureCustomerBootstrap(supabase, user).then((boot) => {
    if (!boot.ok) {
      logAuthDev('login bootstrap failed', { message: boot.message }, 'warn');
    }
  });
}

export default function AuthPage() {
  const router = useRouter();
  const redirectRef = useRef('/');

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loginSubmitRef = useRef(false);
  const signupSubmitRef = useRef(false);
  const googleSubmitRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    redirectRef.current = safeAuthRedirectPath(params.get('redirect') || '/');

    const modeRaw = params.get('mode');
    if (modeRaw === 'signup' || modeRaw === 'login') {
      setMode(modeRaw);
    }

    const oauthError = params.get('oauth_error');
    if (oauthError) {
      try {
        setError(decodeURIComponent(oauthError));
      } catch {
        setError('Sign-in was interrupted. Please try again.');
      }
    }

    const successMessage = params.get('message');
    if (successMessage) {
      try {
        setMessage(decodeURIComponent(successMessage));
      } catch {
        setMessage('Password updated. Please sign in with your new password.');
      }
    }
  }, []);

  const openResetPage = () => {
    router.push('/reset-password');
  };

  const clearFeedback = useCallback(() => {
    setError('');
    setMessage('');
  }, []);

  const switchMode = useCallback(
    (next: 'login' | 'signup') => {
      setMode(next);
      clearFeedback();
      setPassword('');
      setConfirmPassword('');
      if (next === 'login') {
        setFullName('');
      }
    },
    [clearFeedback],
  );

  async function signInWithGoogle() {
    if (googleSubmitRef.current) return;
    clearFeedback();
    googleSubmitRef.current = true;
    setGoogleLoading(true);

    if (isOAuthSiteUrlLikelyWrongForCurrentHost()) {
      setError(
        'Google sign-in would return to localhost, which this phone cannot reach. Set NEXT_PUBLIC_SITE_URL to your computer\'s LAN URL (for example http://172.20.10.3:3000), add that URL plus /auth/callback under Supabase → Authentication → URL Configuration → Redirect URLs, restart the dev server, then try again.',
      );
      setGoogleLoading(false);
      googleSubmitRef.current = false;
      return;
    }

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authOAuthRedirectUrl(redirectRef.current || '/'),
          /** After logout, show Google account chooser instead of silent SSO reuse. */
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (oauthError) {
        const msg = oauthError.message.toLowerCase();
        const code = (oauthError as { code?: string }).code;
        if (msg.includes('cancel')) {
          setError('Google sign-in was cancelled.');
        } else if (
          msg.includes('fetch') ||
          msg.includes('network') ||
          msg.includes('failed to fetch')
        ) {
          setError('Network issue. Check your connection and try again.');
        } else {
          setError(mapAuthError(oauthError.message, code));
        }
        setGoogleLoading(false);
        googleSubmitRef.current = false;
      }
    } catch {
      setError('Network issue. Check your connection and try again.');
      setGoogleLoading(false);
      googleSubmitRef.current = false;
    }
  }

  async function handleLogin() {
    if (loginSubmitRef.current) return;
    clearFeedback();

    if (!email.trim() || !password) {
      setError('Please enter email and password.');
      return;
    }

    if (!basicEmailOk(email)) {
      setError('Enter a valid email address.');
      return;
    }

    loginSubmitRef.current = true;
    setLoading(true);

    let loginSucceeded = false;

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        const code = (signInError as { code?: string }).code;
        if (isEmailNotConfirmed(signInError.message, code)) {
          setError(mapAuthError(signInError.message, code));
        } else if (isInvalidLoginCredentials(signInError.message, code)) {
          setError(INVALID_PASSWORD_LOGIN_MESSAGE);
        } else {
          setError(mapAuthError(signInError.message, code));
        }
        return;
      }

      loginSucceeded = true;
      const user = data.user ?? data.session?.user;

      setError('');
      setMessage('');
      router.replace(redirectRef.current || '/');

      if (user) {
        runCustomerBootstrapInBackground(user);
      }
    } catch {
      if (!loginSucceeded) {
        setError('Network issue. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
      loginSubmitRef.current = false;
    }
  }

  async function handleSignUp() {
    if (signupSubmitRef.current) return;
    clearFeedback();

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!basicEmailOk(email)) {
      setError('Enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    signupSubmitRef.current = true;
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
          },
          emailRedirectTo: authOAuthRedirectUrl(redirectRef.current || '/'),
        },
      });

      if (signUpError) {
        const code = (signUpError as { code?: string }).code;
        const raw = signUpError.message || '';
        const m = raw.toLowerCase();
        if (
          m.includes('user already registered') ||
          m.includes('already been registered') ||
          m.includes('already registered') ||
          m.includes('email address is already') ||
          m.includes('email already exists')
        ) {
          setError(SIGNUP_EMAIL_IN_USE_MESSAGE);
          return;
        }
        setError(mapAuthError(raw, code));
        return;
      }

      const session = data.session;
      const user = data.user;

      if (session && user) {
        setError('');
        setMessage('');
        router.replace(redirectRef.current || '/');
        runCustomerBootstrapInBackground(user);
        return;
      }

      setMessage(
        'Check your email to confirm your account.\n\nOpen the link we sent you, then return here to sign in.',
      );
      setPassword('');
      setConfirmPassword('');
    } catch {
      setError('Network issue. Check your connection and try again.');
    } finally {
      setLoading(false);
      signupSubmitRef.current = false;
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === 'login') {
      void handleLogin();
    } else {
      void handleSignUp();
    }
  }

  const busy = loading || googleLoading;

  const tabBase =
    'min-h-[44px] flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-bold transition sm:text-base';
  const tabActive =
    'border border-purple-300/80 bg-purple-500/25 text-white shadow-[0_0_20px_rgba(168,85,247,0.25)]';
  const tabIdle =
    'border border-transparent text-purple-200/80 hover:bg-purple-500/10 hover:text-purple-100';

  const primaryBtn = `pointer-events-auto flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-6 py-3.5 text-base font-bold text-black transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_0_45px_rgba(168,85,247,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-60 ${interactivePressable}`;
  const googleBtn = `pointer-events-auto flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-3 rounded-full border border-gray-300 bg-white px-6 py-3.5 text-base font-bold text-black transition hover:-translate-y-0.5 hover:shadow-[0_0_35px_rgba(255,255,255,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-60 ${interactivePressable}`;
  const textLink =
    'text-sm font-semibold text-purple-200 underline-offset-2 transition hover:text-white hover:underline';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      {busy ? (
        <BrandLoader
          variant="overlay"
          message={
            googleLoading
              ? 'Signing you in with Google…'
              : mode === 'signup'
                ? 'Creating your account…'
                : 'Signing you in…'
          }
        />
      ) : null}
      <Navbar />

      <section className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-purple-300/20 bg-white/5 p-6 shadow-[0_18px_70px_rgba(168,85,247,0.18)] backdrop-blur-xl sm:p-8">
          <p className="text-sm uppercase tracking-[0.35em] text-purple-300">
            Bunny&apos;s Whisper
          </p>

          <div
            className="mt-6 flex gap-1 rounded-2xl border border-purple-950/80 bg-[#05030d] p-1"
            role="tablist"
            aria-label="Authentication mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
              disabled={busy}
              suppressHydrationWarning
              className={`${tabBase} ${mode === 'login' ? tabActive : tabIdle} disabled:opacity-50`}
            >
              Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => switchMode('signup')}
              disabled={busy}
              suppressHydrationWarning
              className={`${tabBase} ${mode === 'signup' ? tabActive : tabIdle} disabled:opacity-50`}
            >
              Sign Up
            </button>
          </div>

          <h1 className="mt-6 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            {mode === 'login' ? 'Welcome back' : "Create your Bunny's Whisper account"}
          </h1>

          <p className="mt-3 text-sm text-gray-400 sm:text-base">
            {mode === 'login'
              ? 'Sign in to continue your secure checkout and order tracking.'
              : 'Create a password account, or continue with Google — same premium experience.'}
          </p>

          <div className="mt-8">
            <form
              id="auth-form"
              name="auth"
              noValidate
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              suppressHydrationWarning
            >
              {mode === 'signup' && (
                <>
                <VisuallyHidden as="label" htmlFor="auth-full-name">
                  Full name
                </VisuallyHidden>
                <input
                  type="text"
                  id="auth-full-name"
                  name="fullName"
                  autoComplete="name"
                  placeholder="Full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={busy}
                  suppressHydrationWarning
                  className={INPUT_CLASS}
                />
                </>
              )}

              <VisuallyHidden as="label" htmlFor="auth-email">
                Email address
              </VisuallyHidden>
              <input
                type="email"
                id="auth-email"
                name="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                suppressHydrationWarning
                className={INPUT_CLASS}
              />

              <VisuallyHidden as="label" htmlFor="auth-password">
                Password
              </VisuallyHidden>
              <input
                type="password"
                id="auth-password"
                name="password"
                dir="ltr"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                suppressHydrationWarning
                className={PASSWORD_INPUT_CLASS}
              />

              {mode === 'signup' && (
                <>
                <VisuallyHidden as="label" htmlFor="auth-confirm-password">
                  Confirm password
                </VisuallyHidden>
                <input
                  type="password"
                  id="auth-confirm-password"
                  name="confirmPassword"
                  dir="ltr"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={busy}
                  suppressHydrationWarning
                  className={PASSWORD_INPUT_CLASS}
                />
                </>
              )}

              {mode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openResetPage}
                    suppressHydrationWarning
                    className={`${textLink} min-h-[44px] px-1 py-1`}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                aria-busy={loading}
                suppressHydrationWarning
                className={primaryBtn}
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account'}
              </button>
            </form>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-purple-950" />
                <span className="text-xs uppercase tracking-[0.25em] text-gray-500">or</span>
                <div className="h-px flex-1 bg-purple-950" />
              </div>

              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={busy}
                aria-busy={googleLoading}
                suppressHydrationWarning
                className={googleBtn}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-lg font-black text-blue-600">
                  G
                </span>
                {googleLoading ? 'Opening Google…' : 'Continue with Google'}
              </button>

              <p className="text-center text-xs leading-relaxed text-gray-500 sm:text-sm">
                Google sign-in and password sign-in are separate unless you created a password.
              </p>

              <p className="text-center text-sm text-gray-500">
                {mode === 'login' ? (
                  <>
                    New here?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      disabled={busy}
                      suppressHydrationWarning
                      className={`font-bold text-purple-200 transition hover:text-white disabled:opacity-50 ${interactivePressable}`}
                    >
                      Switch to Sign Up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      disabled={busy}
                      suppressHydrationWarning
                      className={`font-bold text-purple-200 transition hover:text-white disabled:opacity-50 ${interactivePressable}`}
                    >
                      Switch to Login
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>

          {message ? (
            <div className="mt-4 rounded-xl border border-purple-300/60 bg-purple-300/10 p-4 text-sm leading-relaxed text-purple-100 sm:text-base whitespace-pre-line">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl border border-red-400/60 bg-red-500/10 p-4 text-sm text-red-200 sm:text-base">
              <p className="leading-relaxed">{error}</p>
            </div>
          ) : null}

          <Link
            href="/"
            className="mt-4 flex min-h-[44px] items-center justify-center text-center text-sm text-gray-400 transition hover:text-purple-200"
          >
            Return to store
          </Link>
        </div>
      </section>
    </main>
  );
}
