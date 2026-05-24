'use client';

import { useState } from 'react';
import { interactivePressable } from '@/lib/interactivePressable';

const selectClass =
  'h-9 w-full appearance-none rounded-md border border-purple-900/50 bg-[#05070d]/60 px-3 pr-8 text-sm text-white outline-none transition focus:border-purple-300/60 focus:ring-1 focus:ring-purple-400/20';

const labelClass =
  'mb-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-purple-300/65 sm:text-[10px]';

export type PublicReviewsFilterValues = {
  ratingFilter: number | 'all';
  sort: 'newest' | 'oldest';
};

type PublicReviewsFiltersProps = {
  values: PublicReviewsFilterValues;
  onRatingChange: (rating: number | 'all') => void;
  onSortChange: (sort: 'newest' | 'oldest') => void;
};

function PublicReviewsRatingStars({
  ratingFilter,
  onRatingChange,
}: {
  ratingFilter: number | 'all';
  onRatingChange: (rating: number | 'all') => void;
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const selected = ratingFilter === 'all' ? 0 : ratingFilter;
  const display = hoverRating || selected;
  const showingAll = ratingFilter === 'all';

  return (
    <div className="min-w-0">
      <p id="reviews-rating-filter-label" className={labelClass}>
        Filter by rating
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="group"
          aria-labelledby="reviews-rating-filter-label"
          className="flex items-center gap-0.5 sm:gap-1"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = star <= display;
            return (
              <button
                key={star}
                type="button"
                aria-label={`Filter by ${star} star${star === 1 ? '' : 's'}`}
                aria-pressed={!showingAll && star <= selected}
                onClick={() => onRatingChange(star)}
                onMouseEnter={() => setHoverRating(star)}
                className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-2xl leading-none transition sm:min-h-9 sm:min-w-9 sm:text-[1.65rem] ${interactivePressable} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70`}
              >
                <span
                  className={
                    filled
                      ? 'text-purple-300 drop-shadow-[0_0_8px_rgba(216,180,254,0.35)]'
                      : 'text-purple-950/75'
                  }
                  aria-hidden
                >
                  {filled ? '★' : '☆'}
                </span>
              </button>
            );
          })}
        </div>

        {showingAll ? (
          <span className="text-xs text-purple-300/55">All ratings</span>
        ) : (
          <span className="text-xs text-purple-200/80">
            {selected} star{selected === 1 ? '' : 's'}
          </span>
        )}

        <button
          type="button"
          aria-label="Show all ratings"
          onClick={() => onRatingChange('all')}
          disabled={showingAll}
          className={`min-h-9 rounded-full border border-purple-900/55 bg-[#05070d]/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-purple-300/80 transition disabled:cursor-default disabled:opacity-40 sm:min-h-8 ${interactivePressable} hover:border-purple-400/45 hover:bg-purple-500/10 hover:text-purple-100 disabled:hover:border-purple-900/55 disabled:hover:bg-[#05070d]/55`}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function PublicReviewsFilters({
  values,
  onRatingChange,
  onSortChange,
}: PublicReviewsFiltersProps) {
  return (
    <div className="mb-4 min-w-0 sm:mb-5">
      <div className="mx-auto w-full max-w-[47rem] px-1 sm:px-0">
        <p className="mb-2 text-center text-[9px] font-medium uppercase tracking-[0.22em] text-purple-300/45 sm:mb-2.5 sm:text-[10px] sm:tracking-[0.24em]">
          Filter reviews
        </p>

        <div className="rounded-xl border border-purple-400/10 bg-[#0b0f1a]/35 px-3 py-2.5 shadow-[0_4px_24px_rgba(168,85,247,0.05)] sm:px-4 sm:py-3">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <PublicReviewsRatingStars
              ratingFilter={values.ratingFilter}
              onRatingChange={onRatingChange}
            />

            <div className="min-w-0 sm:w-44 sm:shrink-0">
              <label htmlFor="reviews-filter-sort" className={labelClass}>
                Sort
              </label>
              <div className="relative">
                <select
                  id="reviews-filter-sort"
                  name="sort"
                  value={values.sort}
                  onChange={(e) =>
                    onSortChange(e.target.value as 'newest' | 'oldest')
                  }
                  className={selectClass}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
                <span
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-purple-300/50"
                  aria-hidden
                >
                  ▾
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PublicReviewsFiltersSkeleton() {
  return (
    <div className="mb-4 min-w-0 sm:mb-5" aria-hidden>
      <div className="mx-auto w-full max-w-[47rem] px-1 sm:px-0">
        <div className="mx-auto mb-2.5 h-2.5 w-20 animate-pulse rounded bg-purple-950/40 sm:h-3 sm:w-24" />
        <div className="rounded-xl border border-purple-400/10 bg-[#0b0f1a]/35 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  className="h-10 w-10 animate-pulse rounded-lg bg-purple-950/40 sm:h-9 sm:w-9"
                />
              ))}
            </div>
            <div className="h-9 w-full animate-pulse rounded-md bg-purple-950/40 sm:w-44" />
          </div>
        </div>
      </div>
    </div>
  );
}
