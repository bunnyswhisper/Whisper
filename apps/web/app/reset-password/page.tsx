'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';
import Navbar from '@/components/Navbar';
import { authPasswordResetRedirectUrl } from '@/lib/api';
import { mapAuthError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabaseClient';
import { interactivePressable } from '@/lib/interactivePressable';

const INPUT_CLASS =
  'min-h-[44px] w-full rounded-xl border border-solid border-purple-950 bg-[#07030d] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)] disabled:opacity-60';

const PASSWORD_INPUT_CLASS = `${INPUT_CLASS} text-left [direction:ltr]`;

const REQUEST_SUCCESS =
  'If this email is registered, we sent a reset link.';

type PageMode = 'request' | 'recovery';

function basicEmailOk(value: string): boolean {
  const t = value.trim();
  return t.includes('@') && t.length >= 5 && !t.includes(' ');
}

function hasRecoverySignals(
  searchParams: URLSearchParams,
  hashParams: URLSearchParams,
): boolean {
  return (
    hashParams.get('type') === 'recovery' ||
    searchParams.get('type') === 'recovery' ||
    Boolean(hashParams.get('access_token')) ||
    Boolean(searchParams.get('token_hash')) ||
    Boolean(searchParams.get('code'))
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();

  const [mode, setMode] = useState<PageMode>('request');
  const [modeReady, setModeReady] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function detectMode() {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ''),
      );
      const recoveryInUrl = hasRecoverySignals(searchParams, hashParams);

      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !exchangeError) {
          setMode('recovery');
          setModeReady(true);
          return;
        }
      }

      const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
        if (cancelled) return;
        if (event === 'PASSWORD_RECOVERY') {
          setMode('recovery');
        }
      });
      unsubscribe = () => authListener.subscription.unsubscribe();

      if (recoveryInUrl) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && session) {
          setMode('recovery');
          setModeReady(true);
          return;
        }
      }

      if (!cancelled) {
        setMode('request');
        setModeReady(true);
      }
    }

    void detectMode();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function sendResetLink() {
    setError('');
    setMessage('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!basicEmailOk(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: authPasswordResetRedirectUrl(),
        },
      );

      if (resetError) {
        const code = (resetError as { code?: string }).code;
        setError(mapAuthError(resetError.message, code));
        return;
      }

      setMessage(REQUEST_SUCCESS);
    } catch {
      setError('Network issue. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword() {
    setError('');
    setMessage('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        const code = (updateError as { code?: string }).code;
        setError(mapAuthError(updateError.message, code));
        return;
      }

      await supabase.auth.signOut();

      const successMsg = encodeURIComponent(
        'Password updated. Please sign in with your new password.',
      );
      router.replace(`/auth?message=${successMsg}`);
    } catch {
      setError('Network issue. Check your connection and try again.');
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === 'recovery') {
      void updatePassword();
    } else {
      void sendResetLink();
    }
  }

  const isRecovery = mode === 'recovery';
  const primaryBtn = `pointer-events-auto flex min-h-[44px] w-full touch-manipulation items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-6 py-3.5 text-base font-bold text-black transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_0_45px_rgba(168,85,247,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-200 disabled:cursor-not-allowed disabled:opacity-60 ${interactivePressable}`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />

      <section className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <div className="w-full rounded-3xl border border-purple-300/20 bg-white/5 p-6 shadow-[0_18px_70px_rgba(168,85,247,0.18)] backdrop-blur-xl sm:p-8">
          <p className="text-sm uppercase tracking-[0.35em] text-purple-300">
            Bunny&apos;s Whisper
          </p>

          <h1 className="mt-6 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            {!modeReady
              ? 'Reset Password'
              : isRecovery
                ? 'Reset Password'
                : 'Forgot your password?'}
          </h1>

          <p className="mt-3 text-sm text-gray-400 sm:text-base">
            {!modeReady
              ? 'Checking your reset link…'
              : isRecovery
                ? 'Choose a new password. After updating, you will sign in again.'
                : 'Enter your email and we’ll send you a secure reset link.'}
          </p>

          <div className="mt-8">
            <form
              noValidate
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              suppressHydrationWarning
            >
              {!modeReady ? (
                <p className="text-sm text-gray-500">Please wait…</p>
              ) : isRecovery ? (
                <>
                  <VisuallyHidden as="label" htmlFor="reset-password-new">
                    New password
                  </VisuallyHidden>
                  <input
                    type="password"
                    id="reset-password-new"
                    name="password"
                    dir="ltr"
                    autoComplete="new-password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    suppressHydrationWarning
                    className={PASSWORD_INPUT_CLASS}
                  />

                  <VisuallyHidden as="label" htmlFor="reset-password-confirm">
                    Confirm new password
                  </VisuallyHidden>
                  <input
                    type="password"
                    id="reset-password-confirm"
                    name="confirmPassword"
                    dir="ltr"
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    suppressHydrationWarning
                    className={PASSWORD_INPUT_CLASS}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    suppressHydrationWarning
                    className={primaryBtn}
                  >
                    {loading ? 'Updating…' : 'Update Password'}
                  </button>
                </>
              ) : (
                <>
                  <VisuallyHidden as="label" htmlFor="reset-email">
                    Email address
                  </VisuallyHidden>
                  <input
                    type="email"
                    id="reset-email"
                    name="email"
                    autoComplete="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    suppressHydrationWarning
                    className={INPUT_CLASS}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    suppressHydrationWarning
                    className={primaryBtn}
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </>
              )}
            </form>

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
              href="/auth"
              className="mt-4 flex min-h-[44px] items-center justify-center text-center text-sm text-gray-400 transition hover:text-purple-200"
            >
              Back to login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
