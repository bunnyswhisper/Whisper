'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { PublicReviewForm } from '@/components/reviews/PublicReviewForm';
import { interactivePressable } from '@/lib/interactivePressable';
import { scrollToAnchor } from '@/lib/scrollAnchor';

const REVIEW_ANCHOR_ID = 'review-action-anchor';

type Phase = 'form' | 'success';

export default function NewPublicReviewPage() {
  const [phase, setPhase] = useState<Phase>('form');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (phase === 'success') {
      scrollToAnchor(REVIEW_ANCHOR_ID);
    }
  }, [phase]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8">
      <Navbar />

      <section className="mx-auto max-w-lg">
        <div
          id={REVIEW_ANCHOR_ID}
          className="scroll-mt-6 rounded-3xl border border-purple-950/80 bg-[#0b0f1a] p-6 shadow-[0_18px_50px_rgba(168,85,247,0.15)] sm:p-8"
        >
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-purple-300/80">
            Bunny&apos;s Whisper
          </p>

          {phase === 'success' ? (
            <>
              <h1 className="mt-3 text-2xl font-black text-green-300 sm:text-3xl">
                Thank you
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-gray-300">
                {successMessage ||
                  'Thank you — your review has been received and will be reviewed before it appears on our site.'}
              </p>
              <Link
                href="/reviews"
                className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/15 px-8 py-3 text-sm font-bold text-purple-100 hover:border-purple-300 ${interactivePressable}`}
              >
                Back to reviews
              </Link>
            </>
          ) : (
            <>
              <h1 className="mt-3 bg-linear-to-r from-white via-purple-100 to-fuchsia-400 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
                Place your review
              </h1>
              <p className="mt-3 text-sm text-gray-400">
                Share your experience with Bunny&apos;s Whisper. Public submissions
                are moderated before they appear on our reviews page.
              </p>

              <PublicReviewForm
                onSuccess={(message) => {
                  setSuccessMessage(message);
                  setPhase('success');
                }}
              />

              <Link
                href="/reviews"
                className={`mt-4 inline-flex min-h-10 w-full items-center justify-center text-xs font-bold text-purple-300 hover:text-white ${interactivePressable}`}
              >
                ← Back to reviews
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
