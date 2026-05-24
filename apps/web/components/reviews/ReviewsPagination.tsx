'use client';

import { interactivePressable } from '@/lib/interactivePressable';

type ReviewsPaginationProps = {
  offset: number;
  pageSize: number;
  total: number;
  itemCount: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function ReviewsPagination({
  offset,
  pageSize,
  total,
  itemCount,
  hasPrevious,
  hasNext,
  loading = false,
  onPrevious,
  onNext,
}: ReviewsPaginationProps) {
  const canGoBack = hasPrevious ?? offset > 0;
  const canGoForward = hasNext ?? offset + pageSize < total;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = total === 0 ? 0 : offset + itemCount;

  return (
    <nav
      className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between"
      aria-label="Reviews pagination"
    >
      <p className="text-xs text-gray-500" aria-live="polite">
        {total === 0 ? 'No reviews' : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canGoBack || loading}
          onClick={onPrevious}
          aria-label="Previous page"
          className={`min-h-10 min-w-10 rounded-full border border-purple-300/40 px-4 py-2 text-xs font-bold text-purple-100 disabled:cursor-not-allowed disabled:opacity-40 ${interactivePressable}`}
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={!canGoForward || loading}
          onClick={onNext}
          aria-label="Next page"
          className={`min-h-10 min-w-10 rounded-full border border-purple-300/40 px-4 py-2 text-xs font-bold text-purple-100 disabled:cursor-not-allowed disabled:opacity-40 ${interactivePressable}`}
        >
          Next →
        </button>
      </div>
    </nav>
  );
}
