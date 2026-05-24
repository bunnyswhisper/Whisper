'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import {
  CustomerReviewForm,
  type CustomerReviewFormInitial,
  type CustomerReviewFormPayload,
} from '@/components/reviews/CustomerReviewForm';
import { StarRating } from '@/components/reviews/StarRating';
import { getSafeSession } from '@/lib/authSession';
import { interactivePressable } from '@/lib/interactivePressable';
import { scrollToAnchor } from '@/lib/scrollAnchor';
import {
  DEFAULT_REVIEW_PHONE_COUNTRY,
  REVIEW_PHONE_COUNTRY_OPTIONS,
  type ReviewPhoneCountryCode,
} from '@/lib/reviewPhone';
import {
  fetchReviewInvite,
  formatReviewDate,
  submitReview,
  type ReviewInviteMyReview,
  type ReviewInvitePrefill,
} from '@/lib/reviewsApi';

type Phase = 'loading' | 'form' | 'success' | 'already' | 'invalid' | 'error';

const REVIEW_ANCHOR_ID = 'review-action-anchor';

function mergePrefill(
  orderPrefill: ReviewInvitePrefill | undefined,
  sessionName: string | null,
  sessionEmail: string | null,
): CustomerReviewFormInitial {
  const phoneCode = orderPrefill?.reviewerPhoneCountryCode;
  const validCode = REVIEW_PHONE_COUNTRY_OPTIONS.some((o) => o.code === phoneCode)
    ? (phoneCode as ReviewPhoneCountryCode)
    : DEFAULT_REVIEW_PHONE_COUNTRY;

  return {
    reviewerName: orderPrefill?.reviewerName || sessionName || undefined,
    reviewerEmail: orderPrefill?.reviewerEmail || sessionEmail || undefined,
    phoneCountryCode: orderPrefill?.reviewerPhone ? validCode : undefined,
    reviewerPhone: orderPrefill?.reviewerPhone || undefined,
    productName: orderPrefill?.publicProductName || undefined,
  };
}

export default function ReviewPage() {
  const params = useParams();
  const token = typeof params.token === 'string' ? params.token : '';

  const [phase, setPhase] = useState<Phase>('loading');
  const [orderRef, setOrderRef] = useState('');
  const [orderPrefill, setOrderPrefill] = useState<ReviewInvitePrefill | undefined>();
  const [sessionPrefill, setSessionPrefill] = useState<{
    name: string | null;
    email: string | null;
  }>({ name: null, email: null });
  const [myReview, setMyReview] = useState<ReviewInviteMyReview | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase('invalid');
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const session = await getSafeSession();
        if (!cancelled && session?.user) {
          const meta = session.user.user_metadata as Record<string, unknown>;
          const name =
            (typeof meta?.full_name === 'string' && meta.full_name) ||
            (typeof meta?.name === 'string' && meta.name) ||
            null;
          setSessionPrefill({
            name,
            email: session.user.email?.trim().toLowerCase() || null,
          });
        }

        const invite = await fetchReviewInvite(token);
        if (cancelled) return;
        setOrderRef(invite.orderRef);
        setOrderPrefill(invite.prefill);
        setMyReview(invite.myReview ?? null);
        if (invite.alreadyReviewed || !invite.canSubmit) {
          setPhase('already');
        } else {
          setPhase('form');
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === 'invalid') {
          setPhase('invalid');
        } else {
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const formInitial = useMemo(
    () => mergePrefill(orderPrefill, sessionPrefill.name, sessionPrefill.email),
    [orderPrefill, sessionPrefill],
  );

  async function handleSubmit(payload: CustomerReviewFormPayload) {
    await submitReview({
      token,
      rating: payload.rating,
      reviewerName: payload.reviewerName,
      reviewerEmail: payload.reviewerEmail,
      reviewerPhoneCountryCode: payload.reviewerPhoneCountryCode,
      reviewerPhone: payload.reviewerPhone,
      reviewText: payload.reviewText,
      publicProductName: payload.publicProductName,
    });
    setPhase('success');
    scrollToAnchor(REVIEW_ANCHOR_ID);
  }

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

          {phase === 'loading' ? (
            <>
              <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Loading your review…
              </h1>
              <p className="mt-4 text-sm text-gray-400">One moment.</p>
            </>
          ) : null}

          {phase === 'invalid' ? (
            <>
              <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Link not valid
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-gray-400">
                This review link is invalid or has expired. If you received a newer
                delivery email, use the latest link.
              </p>
              <Link
                href="/"
                className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-8 py-3 text-sm font-bold text-black hover:bg-white ${interactivePressable}`}
              >
                Continue shopping
              </Link>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Something went wrong
              </h1>
              <p className="mt-4 text-sm text-gray-400">
                We couldn&apos;t load this review page. Please refresh or try again
                later.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/15 px-8 py-3 text-sm font-bold text-purple-100 hover:border-purple-300 ${interactivePressable}`}
              >
                Retry
              </button>
            </>
          ) : null}

          {phase === 'already' ? (
            <>
              <h1 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Thank you
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-gray-300">
                Your review for order{' '}
                <span className="font-bold text-purple-200">{orderRef}</span> is on
                file. We appreciate your feedback.
              </p>
              {myReview ? (
                <div className="mt-6 rounded-2xl border border-purple-950/80 bg-[#05070d] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-purple-100">Your review</p>
                    <StarRating rating={myReview.rating} size="sm" />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatReviewDate(myReview.createdAt)}
                  </p>
                  {myReview.reviewText ? (
                    <p className="mt-3 text-sm text-gray-300">{myReview.reviewText}</p>
                  ) : null}
                  {myReview.adminReply ? (
                    <div className="mt-4 rounded-xl border border-purple-300/25 bg-purple-500/10 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">
                        Reply from Bunny&apos;s Whisper
                      </p>
                      <p className="mt-2 text-sm text-purple-50">
                        {myReview.adminReply.text}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <Link
                href="/reviews"
                className={`mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/15 px-8 py-3 text-sm font-bold text-purple-100 hover:border-purple-300 ${interactivePressable}`}
              >
                Browse all reviews
              </Link>
              <Link
                href="/"
                className={`mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-8 py-3 text-sm font-bold text-black hover:bg-white ${interactivePressable}`}
              >
                Continue shopping
              </Link>
            </>
          ) : null}

          {phase === 'success' ? (
            <>
              <h1 className="mt-3 text-2xl font-black text-green-300 sm:text-3xl">
                Review received
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-gray-300">
                Thank you for sharing your experience with Bunny&apos;s Whisper.
                Your feedback helps us improve.
              </p>
              <Link
                href="/"
                className={`mt-8 inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-8 py-3 text-sm font-bold text-black hover:bg-white ${interactivePressable}`}
              >
                Continue shopping
              </Link>
            </>
          ) : null}

          {phase === 'form' ? (
            <>
              <h1 className="mt-3 bg-linear-to-r from-white via-purple-100 to-fuchsia-400 bg-clip-text text-2xl font-black text-transparent sm:text-3xl">
                How was your order?
              </h1>
              <p className="mt-3 text-sm text-gray-400">
                Order reference{' '}
                <span className="font-bold text-purple-200">{orderRef}</span>
              </p>

              <CustomerReviewForm
                key={`${token}-${orderRef}-${sessionPrefill.email ?? 'guest'}`}
                initial={formInitial}
                submitLabel="Submit review"
                onSubmit={handleSubmit}
                onSubmitError={(err) => {
                  if (err instanceof Error && err.message === 'already_reviewed') {
                    setPhase('already');
                    scrollToAnchor(REVIEW_ANCHOR_ID);
                    return '';
                  }
                  if (err instanceof Error && err.message === 'invalid') {
                    setPhase('invalid');
                    scrollToAnchor(REVIEW_ANCHOR_ID);
                    return '';
                  }
                  return null;
                }}
              />
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
