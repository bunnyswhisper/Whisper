'use client';

import { interactivePressable } from '@/lib/interactivePressable';

export type AdminReviewsFilterValues = {
  ratingFilter: number | 'all';
  sort: 'newest' | 'oldest';
  searchDraft: string;
};

type AdminReviewsFiltersProps = {
  values: AdminReviewsFilterValues;
  onRatingChange: (rating: number | 'all') => void;
  onSortChange: (sort: 'newest' | 'oldest') => void;
  onSearchDraftChange: (value: string) => void;
  onSearch: () => void;
};

export function AdminReviewsFilters({
  values,
  onRatingChange,
  onSortChange,
  onSearchDraftChange,
  onSearch,
}: AdminReviewsFiltersProps) {
  return (
    <div className="mb-5 flex min-w-0 flex-col gap-2.5 rounded-2xl border border-purple-400/15 bg-[#0b0f1a]/80 p-3 shadow-[0_8px_32px_rgba(168,85,247,0.06)] sm:mb-6 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3 sm:p-3.5">
      <div className="min-w-0 flex-1 sm:max-w-[160px]">
        <label
          htmlFor="admin-reviews-filter-rating"
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300/80"
        >
          Rating
        </label>
        <select
          id="admin-reviews-filter-rating"
          name="ratingFilter"
          value={values.ratingFilter === 'all' ? 'all' : String(values.ratingFilter)}
          onChange={(e) => {
            const v = e.target.value;
            onRatingChange(v === 'all' ? 'all' : Number(v));
          }}
          className="mt-1 h-9 w-full rounded-lg border border-purple-900/70 bg-[#05070d]/90 px-3 text-sm text-white outline-none focus:border-purple-300/70"
        >
          <option value="all">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} stars
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 flex-1 sm:max-w-[160px]">
        <label
          htmlFor="admin-reviews-filter-sort"
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300/80"
        >
          Sort
        </label>
        <select
          id="admin-reviews-filter-sort"
          name="sort"
          value={values.sort}
          onChange={(e) => onSortChange(e.target.value as 'newest' | 'oldest')}
          className="mt-1 h-9 w-full rounded-lg border border-purple-900/70 bg-[#05070d]/90 px-3 text-sm text-white outline-none focus:border-purple-300/70"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
      </div>

      <div className="min-w-0 flex-[2]">
        <label
          htmlFor="admin-reviews-filter-search"
          className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300/80"
        >
          Search
        </label>
        <div className="mt-1.5 flex min-w-0 gap-2">
          <input
            id="admin-reviews-filter-search"
            name="search"
            type="search"
            value={values.searchDraft}
            onChange={(e) => onSearchDraftChange(e.target.value)}
            placeholder="Search name or text"
            className="mt-1 h-9 min-w-0 flex-1 rounded-lg border border-purple-900/70 bg-[#05070d]/90 px-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300/70"
          />
          <button
            type="button"
            name="applySearch"
            onClick={onSearch}
            className={`h-9 shrink-0 rounded-full border border-purple-300/50 px-4 text-xs font-bold text-purple-100 ${interactivePressable}`}
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminReviewsFiltersSkeleton() {
  return (
    <div
      className="mb-6 flex min-w-0 gap-3 rounded-2xl border border-purple-950/80 bg-[#0b0f1a] p-4"
      aria-hidden
    >
      <div className="min-h-10 min-w-0 flex-1 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="min-h-10 min-w-0 flex-1 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="min-h-10 min-w-0 flex-[2] animate-pulse rounded-xl bg-purple-950/40" />
    </div>
  );
}
