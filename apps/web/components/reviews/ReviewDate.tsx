'use client';

import { formatReviewDate } from '@/lib/reviewsApi';

type ReviewDateProps = {
  iso: string;
  className?: string;
};

/** Displays a review timestamp using deterministic UTC formatting (no locale drift). */
export function ReviewDate({ iso, className }: ReviewDateProps) {
  return <time dateTime={iso} className={className}>{formatReviewDate(iso)}</time>;
}
