'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AdminOnly from '@/components/AdminOnly';
import Navbar from '@/components/Navbar';
import { PremiumEmptyState } from '@/components/empty-state';
import { AdminReviewCard } from '@/components/reviews/AdminReviewCard';
import { MountedOnly } from '@/components/reviews/MountedOnly';
import {
  AdminReviewsFilters,
  AdminReviewsFiltersSkeleton,
} from '@/components/reviews/AdminReviewsFilters';
import {
  fetchAdminReviews,
  patchAdminReviewApprove,
  patchAdminReviewDelete,
  patchAdminReviewHide,
  patchAdminReviewReply,
  patchAdminReviewRestore,
  patchAdminReviewUnhide,
  type AdminReview,
} from '@/lib/reviewsApi';
import { ReviewsPagination } from '@/components/reviews/ReviewsPagination';
import { interactivePressable } from '@/lib/interactivePressable';
import { getSafeSession } from '@/lib/authSession';
import { scrollToAnchor, withPreservedScroll } from '@/lib/scrollAnchor';

const ADMIN_REVIEWS_ANCHOR = 'admin-reviews-anchor';
const ADMIN_FEEDBACK_ANCHOR = 'admin-reviews-feedback';

type Tab = 'active' | 'pending' | 'hidden' | 'deleted';

const PAGE_SIZE = 10;

export default function AdminReviewsPage() {
  return (
    <AdminOnly>
      <AdminReviewsContent />
    </AdminOnly>
  );
}

function AdminReviewsContent() {
  const [tab, setTab] = useState<Tab>('active');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [total, setTotal] = useState(0);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [offset, setOffset] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reloadList = useCallback(
    async (preferredOffset?: number) => {
      const session = await getSafeSession();
      if (!session) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let pageOffset = preferredOffset ?? offset;

        const fetchPage = (pageOff: number) =>
          fetchAdminReviews(session.access_token, {
            state: tab,
            rating: ratingFilter === 'all' ? undefined : ratingFilter,
            sort,
            search: search || undefined,
            limit: PAGE_SIZE,
            offset: pageOff,
          });

        let res = await fetchPage(pageOffset);
        if (res.reviews.length === 0 && pageOffset > 0 && res.total > 0) {
          pageOffset = Math.max(0, pageOffset - PAGE_SIZE);
          setOffset(pageOffset);
          res = await fetchPage(pageOffset);
        }

        setReviews(res.reviews);
        setTotal(res.total);
        setHasPrevious(res.hasPrevious);
        setHasNext(res.hasNext);
      } catch {
        setReviews([]);
        setTotal(0);
        setHasPrevious(false);
        setHasNext(false);
        setFeedback('Could not load reviews.');
      } finally {
        setLoading(false);
      }
    },
    [tab, ratingFilter, sort, search, offset],
  );

  useEffect(() => {
    void reloadList();
  }, [reloadList]);

  async function withSession<T>(
    fn: (token: string) => Promise<T>,
  ): Promise<T | null> {
    const session = await getSafeSession();
    if (!session) return null;
    setBusy(true);
    try {
      return await fn(session.access_token);
    } finally {
      setBusy(false);
    }
  }

  async function afterAdminAction(message: string, reloadOffset?: number) {
    setFeedback(message);
    setExpandedId(null);
    await withPreservedScroll(async () => {
      await reloadList(reloadOffset);
    });
    scrollToAnchor(ADMIN_FEEDBACK_ANCHOR, { block: 'nearest' });
  }

  async function handleSaveReply(id: string, adminReply: string) {
    const result = await withSession((token) =>
      patchAdminReviewReply(token, id, { adminReply }),
    );
    if (result) {
      await afterAdminAction('Reply saved.');
    }
  }

  async function handleHide(id: string) {
    const ok = await withSession((token) => patchAdminReviewHide(token, id));
    if (ok) {
      await afterAdminAction('Review hidden.');
    }
  }

  async function handleUnhide(id: string) {
    const ok = await withSession((token) => patchAdminReviewUnhide(token, id));
    if (ok) {
      await afterAdminAction('Review restored to active.');
    }
  }

  async function handleDelete(id: string) {
    const ok = await withSession((token) => patchAdminReviewDelete(token, id));
    if (ok) {
      await afterAdminAction('Review soft-deleted.');
    }
  }

  async function handleRestore(id: string) {
    const ok = await withSession((token) => patchAdminReviewRestore(token, id));
    if (ok) {
      setTab('active');
      setOffset(0);
      await afterAdminAction('Review restored to active.', 0);
    }
  }

  async function handleApprove(id: string) {
    const ok = await withSession((token) => patchAdminReviewApprove(token, id));
    if (ok) {
      await afterAdminAction('Review approved and published.');
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'pending', label: 'Pending' },
    { id: 'hidden', label: 'Hidden' },
    { id: 'deleted', label: 'Deleted' },
  ];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8">
      <Navbar />

      <section id={ADMIN_REVIEWS_ANCHOR} className="mx-auto max-w-3xl scroll-mt-6">
        <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-purple-300/80">
              Admin
            </p>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              Reviews
            </h1>
          </div>
          <Link
            href="/reviews"
            className={`text-center text-xs font-bold text-purple-300 hover:text-white ${interactivePressable}`}
          >
            View public page →
          </Link>
        </div>

        <div
          className="mb-4 flex flex-wrap gap-2"
          role="tablist"
          aria-label="Review moderation tabs"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setOffset(0);
                setExpandedId(null);
              }}
              className={`min-h-10 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide transition ${interactivePressable} ${
                tab === t.id
                  ? 'border-purple-300 bg-purple-500/20 text-white'
                  : 'border-purple-950 text-gray-400 hover:border-purple-300/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <MountedOnly fallback={<AdminReviewsFiltersSkeleton />}>
          <AdminReviewsFilters
            values={{ ratingFilter, sort, searchDraft }}
            onRatingChange={(rating) => {
              setOffset(0);
              setRatingFilter(rating);
            }}
            onSortChange={(next) => {
              setOffset(0);
              setSort(next);
            }}
            onSearchDraftChange={setSearchDraft}
            onSearch={() => {
              setOffset(0);
              setSearch(searchDraft.trim());
            }}
          />
        </MountedOnly>

        {feedback ? (
          <p
            id={ADMIN_FEEDBACK_ANCHOR}
            className="mb-4 scroll-mt-24 rounded-xl border border-purple-300/30 bg-purple-500/10 px-4 py-2 text-sm text-purple-100"
          >
            {feedback}
          </p>
        ) : null}

        {loading && reviews.length === 0 ? (
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-20 animate-pulse rounded-xl border border-purple-950/60 bg-[#0b0f1a]"
              />
            ))}
          </div>
        ) : reviews.length === 0 && !loading ? (
          <PremiumEmptyState
            title={`No ${tab} reviews`}
            description={
              tab === 'active'
                ? 'Submitted reviews will appear here.'
                : `No reviews in the ${tab} section.`
            }
          />
        ) : (
          <div
            className={`space-y-2 transition-opacity duration-200 ${loading ? 'pointer-events-none opacity-50' : ''}`}
            aria-busy={loading}
          >
            {reviews.map((review) => (
              <AdminReviewCard
                key={review.id}
                review={review}
                expanded={expandedId === review.id}
                onToggleExpand={() =>
                  setExpandedId((id) => (id === review.id ? null : review.id))
                }
                busy={busy}
                onSaveReply={handleSaveReply}
                onHide={handleHide}
                onUnhide={handleUnhide}
                onDelete={handleDelete}
                onRestore={handleRestore}
                onApprove={handleApprove}
              />
            ))}
          </div>
        )}

        {total > 0 ? (
          <ReviewsPagination
            offset={offset}
            pageSize={PAGE_SIZE}
            total={total}
            itemCount={reviews.length}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            loading={loading}
            onPrevious={() => {
              setExpandedId(null);
              setOffset((o) => Math.max(0, o - PAGE_SIZE));
            }}
            onNext={() => {
              setExpandedId(null);
              setOffset((o) => o + PAGE_SIZE);
            }}
          />
        ) : null}
      </section>
    </main>
  );
}
