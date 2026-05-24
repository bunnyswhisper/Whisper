'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeAuthRedirectPath } from '@/lib/api';
import { ensureCustomerBootstrap, logAuthDev } from '@/lib/authBootstrap';
import { supabase } from '@/lib/supabaseClient';

import BrandLoader from '@/components/BrandLoader';
import { friendlyOAuthCallbackError } from '@/lib/authErrors';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'working' | 'error'>('working');

  useEffect(() => {
    let cancelled = false;

    async function finishLogin() {
      const redirectTo = safeAuthRedirectPath(searchParams.get('redirect'));
      const code = searchParams.get('code');
      const errorDesc = searchParams.get('error_description');
      const oauthError = searchParams.get('error');

      if (oauthError || errorDesc) {
        if (!cancelled) {
          setStatus('error');
          const raw = errorDesc || oauthError || 'Sign-in was cancelled.';
          const msg = encodeURIComponent(friendlyOAuthCallbackError(raw));
          router.replace(`/auth?redirect=${encodeURIComponent(redirectTo)}&oauth_error=${msg}`);
        }
        return;
      }

      if (code) {
        const { error, data } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!cancelled) {
            setStatus('error');
            const msg = encodeURIComponent(
              friendlyOAuthCallbackError(
                error.message,
                (error as { code?: string }).code,
              ),
            );
            router.replace(
              `/auth?redirect=${encodeURIComponent(redirectTo)}&oauth_error=${msg}`,
            );
          }
          return;
        }
        const user = data.session?.user;
        if (user) {
          const boot = await ensureCustomerBootstrap(supabase, user);
          if (!boot.ok) {
            logAuthDev('oauth bootstrap failed', { message: boot.message }, 'warn');
          }
        }
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setStatus('error');
            const msg = encodeURIComponent(
              'Sign-in link expired or invalid. Please try again.',
            );
            router.replace(
              `/auth?redirect=${encodeURIComponent(redirectTo)}&oauth_error=${msg}`,
            );
          }
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const boot = await ensureCustomerBootstrap(supabase, user);
          if (!boot.ok) {
            logAuthDev('oauth bootstrap failed', { message: boot.message }, 'warn');
          }
        }
      }

      if (!cancelled) {
        router.replace(redirectTo);
      }
    }

    finishLogin();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <BrandLoader
      variant="overlay"
      message={status === 'error' ? 'Redirecting…' : 'Signing you in...'}
    />
  );
}

function AuthCallbackSuspenseFallback() {
  return <BrandLoader variant="overlay" message="Signing you in..." />;
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackSuspenseFallback />}>
      <AuthCallbackContent />
    </Suspense>
  );
}