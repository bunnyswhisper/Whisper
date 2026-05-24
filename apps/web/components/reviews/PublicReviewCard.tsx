'use client';

import { StarRating } from '@/components/reviews/StarRating';
import { ReviewDate } from '@/components/reviews/ReviewDate';
import type { PublicReview } from '@/lib/reviewsApi';

type PublicReviewCardProps = {
  review: PublicReview;
};

export function PublicReviewCard({ review }: PublicReviewCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-purple-300/20 bg-[#0b0f1a] p-5 shadow-[0_12px_40px_rgba(168,85,247,0.1)] sm:p-6">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{review.reviewerName}</p>
          <p className="mt-1 text-xs text-gray-500">
            <ReviewDate iso={review.createdAt} />
          </p>
        </div>
        <StarRating rating={review.rating} size="md" />
      </div>

      {review.productNames.length > 0 ? (
        <p className="mt-3 text-xs text-purple-200/80">
          {review.productNames.join(' · ')}
        </p>
      ) : null}

      {review.reviewText ? (
        <p className="mt-4 text-sm leading-relaxed text-gray-300">{review.reviewText}</p>
      ) : (
        <p className="mt-4 text-sm italic text-gray-500">No written review.</p>
      )}

      {review.adminPublicReply ? (
        <div className="mt-5 rounded-xl border border-purple-300/25 bg-purple-500/10 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-purple-300">
            Reply from Bunny&apos;s Whisper
          </p>
          <p className="mt-2 text-sm leading-relaxed text-purple-50">
            {review.adminPublicReply}
          </p>
        </div>
      ) : null}
    </article>
  );
}
