'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { PremiumEmptyState } from '@/components/empty-state';
import { MountedOnly } from '@/components/reviews/MountedOnly';
import { PublicReviewCard } from '@/components/reviews/PublicReviewCard';
import {
  PublicReviewsFilters,
  PublicReviewsFiltersSkeleton,
} from '@/components/reviews/PublicReviewsFilters';
import { ReviewsPagination } from '@/components/reviews/ReviewsPagination';
import {
  fetchPublicReviews,
  type PublicReview,
} from '@/lib/reviewsApi';
import { interactivePressable } from '@/lib/interactivePressable';

const PAGE_SIZE = 5;

export default function PublicReviewsPage() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [total, setTotal] = useState(0);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetchPublicReviews({
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        sort,
        limit: PAGE_SIZE,
        offset,
      });
      setReviews(res.reviews);
      setTotal(res.total);
      setHasPrevious(res.hasPrevious);
      setHasNext(res.hasNext);
    } catch {
      setError(true);
      setReviews([]);
      setTotal(0);
      setHasPrevious(false);
      setHasNext(false);
    } finally {
      setLoading(false);
    }
  }, [ratingFilter, sort, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const showInitialSkeleton = loading && reviews.length === 0 && !error;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8">
      <Navbar />

      <section className="mx-auto max-w-3xl">
        <header className="mb-8 text-center sm:mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-purple-300/80">
            Bunny&apos;s Whisper
          </p>
          <h1 className="mt-3 bg-linear-to-r from-white via-purple-100 to-fuchsia-400 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            Customer Reviews
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
            Real feedback from our community — curated for you.
          </p>
        </header>

        <MountedOnly fallback={<PublicReviewsFiltersSkeleton />}>
          <PublicReviewsFilters
            values={{ ratingFilter, sort }}
            onRatingChange={(rating) => {
              setOffset(0);
              setRatingFilter(rating);
            }}
            onSortChange={(next) => {
              setOffset(0);
              setSort(next);
            }}
          />
        </MountedOnly>

        {showInitialSkeleton ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading reviews">
            {Array.from({ length: PAGE_SIZE }, (_, i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border border-purple-950/60 bg-[#0b0f1a]"
              />
            ))}
          </div>
        ) : error ? (
          <PremiumEmptyState
            title="Could not load reviews"
            description="Please refresh or try again in a moment."
            primaryAction={{ label: 'Retry', onClick: () => void load() }}
          />
        ) : reviews.length === 0 && !loading ? (
          <PremiumEmptyState
            title="No reviews yet"
            description="Be the first to share your experience after your order arrives."
            primaryAction={{ label: 'Shop collection', href: '/' }}
          />
        ) : (
          <div
            className={`space-y-4 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}
            aria-busy={loading}
          >
            {reviews.map((review) => (
              <PublicReviewCard key={review.id} review={review} />
            ))}
          </div>
        )}

        {!error && total > 0 ? (
          <ReviewsPagination
            offset={offset}
            pageSize={PAGE_SIZE}
            total={total}
            itemCount={reviews.length}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            loading={loading}
            onPrevious={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
            onNext={() => setOffset((o) => o + PAGE_SIZE)}
          />
        ) : null}

        <section className="mt-12 rounded-3xl border border-purple-300/20 bg-linear-to-b from-purple-500/10 to-transparent p-8 text-center shadow-[0_16px_48px_rgba(168,85,247,0.12)]">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-purple-300/80">
            Share your experience
          </p>
          <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
            Loved your Bunny&apos;s Whisper piece?
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-400">
            Leave a review for our community. Submissions are moderated before
            they appear publicly.
          </p>
          <Link
            href="/reviews/new"
            className={`mt-6 inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-10 py-3 text-sm font-bold text-black hover:bg-white ${interactivePressable}`}
          >
            Place Your Review
          </Link>
        </section>
      </section>
    </main>
  );
}
