'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandLoader from '@/components/BrandLoader';
import Navbar from '@/components/Navbar';
import { apiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [phase, setPhase] = useState<'idle' | 'loading' | 'redirecting' | 'error'>(
    'idle',
  );
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!orderId) {
      setPhase('error');
      setErrorMessage('Missing order. Return to checkout and try again.');
      return;
    }

    let cancelled = false;

    async function run() {
      setPhase('loading');
      setErrorMessage('');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push(
          `/auth?redirect=${encodeURIComponent(`/payment?orderId=${orderId}`)}`,
          { scroll: false },
        );
        return;
      }

      const res = await fetch(apiUrl('/payments/paymob/create-intention'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json();

      if (cancelled) return;

      if (!res.ok) {
        setPhase('error');
        setErrorMessage(
          'Could not start card payment. Please return to checkout and try again.',
        );
        return;
      }

      if (data.alreadyPaid && data.redirectUrl) {
        window.location.replace(data.redirectUrl);
        return;
      }

      if (data.checkoutUrl) {
        setPhase('redirecting');
        window.location.href = data.checkoutUrl;
        return;
      }

      setPhase('error');
      setErrorMessage('Paymob did not return a checkout link.');
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-4 py-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />

      <section className="mx-auto max-w-3xl rounded-3xl border border-purple-950 bg-[#0d0716] p-5 text-center shadow-[0_18px_60px_rgba(168,85,247,0.18)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.35em]">
          Secure payment
        </p>

        <h1 className="mt-4 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          {phase === 'error' ? 'Payment could not start' : 'Preparing secure payment…'}
        </h1>

        {phase !== 'error' ? (
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-gray-300 sm:text-base">
            You are being redirected to Paymob to complete your card payment. Please
            do not close this tab until the process finishes.
          </p>
        ) : (
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-red-200 sm:text-base">
            {errorMessage}
          </p>
        )}

        {phase === 'loading' || phase === 'redirecting' ? (
          <div className="mt-8">
            <BrandLoader
              variant="embedded"
              message="Verifying secure payment…"
              className="py-8"
            />
          </div>
        ) : null}

        <Link
          href="/checkout"
          scroll={false}
          className="mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-8 py-4 font-bold text-black transition hover:bg-white sm:w-auto"
        >
          Back to Checkout
        </Link>
      </section>
    </main>
  );
}

function PaymentPageSuspenseFallback() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-4 py-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />
      <section className="mx-auto max-w-3xl rounded-3xl border border-purple-950 bg-[#0d0716] p-5 text-center shadow-[0_18px_60px_rgba(168,85,247,0.18)] sm:p-8">
        <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.35em]">
          Secure payment
        </p>
        <h1 className="mt-4 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          Preparing secure payment…
        </h1>
        <div className="mt-8">
          <BrandLoader variant="embedded" message="Verifying secure payment…" className="py-8" />
        </div>
      </section>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentPageSuspenseFallback />}>
      <PaymentPageContent />
    </Suspense>
  );
}
