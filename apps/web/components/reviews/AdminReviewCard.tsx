'use client';

import { useEffect, useState } from 'react';
import { StarRating } from '@/components/reviews/StarRating';
import type { AdminReview } from '@/lib/reviewsApi';
import { ReviewDate } from '@/components/reviews/ReviewDate';
import { interactivePressable } from '@/lib/interactivePressable';

type AdminReviewCardProps = {
  review: AdminReview;
  expanded: boolean;
  onToggleExpand: () => void;
  onSaveReply: (id: string, adminReply: string) => Promise<void>;
  onHide: (id: string) => Promise<void>;
  onUnhide: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRestore: (id: string) => Promise<void>;
  onApprove: (id: string) => Promise<void>;
  busy?: boolean;
};

function stateBadge(state: AdminReview['state']) {
  if (state === 'deleted') {
    return 'border-red-400/40 bg-red-500/15 text-red-100';
  }
  if (state === 'hidden') {
    return 'border-amber-400/40 bg-amber-500/15 text-amber-100';
  }
  if (state === 'pending') {
    return 'border-sky-400/40 bg-sky-500/15 text-sky-100';
  }
  return 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100';
}

function previewText(text: string | null, max = 72): string {
  const t = text?.trim() ?? '';
  if (!t) return 'No review text.';
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function AdminReviewCard({
  review,
  expanded,
  onToggleExpand,
  onSaveReply,
  onHide,
  onUnhide,
  onDelete,
  onRestore,
  onApprove,
  busy = false,
}: AdminReviewCardProps) {
  const [replyDraft, setReplyDraft] = useState(review.adminReply ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReplyDraft(review.adminReply ?? '');
  }, [review.id, review.adminReply, review.adminReplyUpdatedAt]);

  const savedReply = review.adminReply?.trim() ?? '';
  const replyTimestamp =
    review.adminReplyUpdatedAt ?? review.adminReplyCreatedAt;
  const productLabel =
    review.productNames.length > 0 ? review.productNames.join(' · ') : null;
  const panelId = `admin-review-panel-${review.id}`;

  async function handleSaveReply() {
    setSaving(true);
    try {
      await onSaveReply(review.id, replyDraft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-purple-300/15 bg-[#0b0f1a]">
      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={`flex w-full min-w-0 items-start gap-3 p-3 text-left sm:p-4 ${interactivePressable}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${stateBadge(review.state)}`}
            >
              {review.state}
            </span>
            {review.source === 'public' ? (
              <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-100">
                Public
              </span>
            ) : (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-100">
                Order
              </span>
            )}
          </div>
          <p className="mt-1.5 truncate text-sm font-bold text-white">
            {review.reviewerName || 'Anonymous'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            <ReviewDate iso={review.createdAt} />
            {productLabel ? (
              <span className="text-purple-200/70"> · {productLabel}</span>
            ) : null}
          </p>
          {!expanded ? (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-400">
              {previewText(review.reviewText)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StarRating rating={review.rating} size="sm" />
          <span className="text-[10px] font-bold uppercase tracking-wide text-purple-300">
            {expanded ? 'Collapse' : 'Details'}
          </span>
        </div>
      </button>

      {expanded ? (
        <div
          id={panelId}
          className="border-t border-purple-950/80 px-3 pb-4 pt-3 sm:px-4 sm:pb-5"
        >
          {review.reviewText ? (
            <p className="text-sm leading-relaxed text-gray-300">{review.reviewText}</p>
          ) : (
            <p className="text-sm italic text-gray-500">No review text.</p>
          )}

          <dl className="mt-4 space-y-2 rounded-xl border border-purple-950/80 bg-[#05070d] p-3 text-xs">
            <div>
              <dt className="font-bold uppercase tracking-wide text-purple-300/80">
                Email
              </dt>
              <dd className="mt-0.5 text-gray-300">
                {review.reviewerEmail ? (
                  <a
                    href={`mailto:${review.reviewerEmail}`}
                    className="text-purple-200 underline-offset-2 hover:text-white hover:underline"
                  >
                    {review.reviewerEmail}
                  </a>
                ) : (
                  <span className="text-gray-500">No email provided</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wide text-purple-300/80">
                Phone
              </dt>
              <dd className="mt-0.5 text-gray-300">
                {review.reviewerPhoneNormalized || review.reviewerPhoneRaw ? (
                  <span className="block space-y-0.5">
                    {review.reviewerPhoneNormalized ? (
                      <a
                        href={`tel:${review.reviewerPhoneNormalized}`}
                        className="text-purple-200 underline-offset-2 hover:text-white hover:underline"
                      >
                        {review.reviewerPhoneNormalized}
                      </a>
                    ) : null}
                    {review.reviewerPhoneRaw ? (
                      <span className="block text-gray-500">
                        Raw: {review.reviewerPhoneCountryCode ?? ''}{' '}
                        {review.reviewerPhoneRaw}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-gray-500">No phone provided</span>
                )}
              </dd>
            </div>
            {review.orderRef ? (
              <div>
                <dt className="font-bold uppercase tracking-wide text-purple-300/80">
                  Order ref
                </dt>
                <dd className="mt-0.5 text-gray-400">{review.orderRef}</dd>
              </div>
            ) : null}
          </dl>

          {review.hiddenAt ? (
            <p className="mt-2 text-xs text-amber-200/80">
              Hidden <ReviewDate iso={review.hiddenAt} />
              {review.hiddenBy ? ` by ${review.hiddenBy}` : ''}
            </p>
          ) : null}
          {review.deletedAt ? (
            <p className="mt-2 text-xs text-red-200/80">
              Deleted <ReviewDate iso={review.deletedAt} />
              {review.deletedBy ? ` by ${review.deletedBy}` : ''}
            </p>
          ) : null}

          <div className="mt-4 rounded-xl border border-purple-950/80 bg-[#05070d] p-3">
            <p
              id={`admin-reply-label-${review.id}`}
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300"
            >
              Admin reply
            </p>

            {savedReply ? (
              <div className="mt-2 rounded-lg border border-purple-300/25 bg-purple-500/10 p-2.5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-white">
                  {savedReply}
                </p>
                {replyTimestamp ? (
                  <p className="mt-1.5 text-[10px] text-gray-500">
                    {review.adminReplyUpdatedAt ? 'Updated' : 'Posted'}{' '}
                    <ReviewDate iso={replyTimestamp} />
                    {review.adminReplyBy ? ` · ${review.adminReplyBy}` : ''}
                  </p>
                ) : null}
              </div>
            ) : null}

            <label
              htmlFor={`admin-reply-draft-${review.id}`}
              className="mt-3 block text-xs font-semibold text-purple-200/90"
            >
              {savedReply ? 'Edit reply' : 'Write reply'}
            </label>
            <textarea
              id={`admin-reply-draft-${review.id}`}
              name="adminReply"
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              rows={3}
              maxLength={4000}
              aria-labelledby={`admin-reply-label-${review.id}`}
              placeholder="Write a public reply…"
              disabled={busy || review.state === 'deleted'}
              className="mt-2 w-full resize-y rounded-xl border border-purple-950 bg-[#07030d] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={busy || saving || review.state === 'deleted'}
              onClick={() => void handleSaveReply()}
              className={`mt-3 min-h-10 rounded-full border border-purple-300/50 bg-purple-500/15 px-5 py-2 text-xs font-bold text-purple-100 hover:border-purple-300 disabled:opacity-50 ${interactivePressable}`}
            >
              {saving ? 'Saving…' : 'Save reply'}
            </button>
          </div>

          <div className="mt-4 flex min-w-0 flex-wrap gap-2">
            {review.state === 'pending' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onApprove(review.id)}
                  className={`min-h-9 rounded-full border border-emerald-300/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 disabled:opacity-50 ${interactivePressable}`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onHide(review.id)}
                  className={`min-h-9 rounded-full border border-amber-300/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-100 disabled:opacity-50 ${interactivePressable}`}
                >
                  Hide
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Soft-delete this pending review?')) {
                      void onDelete(review.id);
                    }
                  }}
                  className={`min-h-9 rounded-full border border-red-300/50 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-100 disabled:opacity-50 ${interactivePressable}`}
                >
                  Delete
                </button>
              </>
            ) : null}
            {review.state === 'active' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onHide(review.id)}
                  className={`min-h-9 rounded-full border border-amber-300/50 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-100 disabled:opacity-50 ${interactivePressable}`}
                >
                  Hide
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Soft-delete this review?')) {
                      void onDelete(review.id);
                    }
                  }}
                  className={`min-h-9 rounded-full border border-red-300/50 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-100 disabled:opacity-50 ${interactivePressable}`}
                >
                  Delete
                </button>
              </>
            ) : null}
            {review.state === 'hidden' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onUnhide(review.id)}
                  className={`min-h-9 rounded-full border border-emerald-300/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-100 disabled:opacity-50 ${interactivePressable}`}
                >
                  Unhide
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm('Soft-delete this hidden review?')) {
                      void onDelete(review.id);
                    }
                  }}
                  className={`min-h-9 rounded-full border border-red-300/50 bg-red-500/15 px-3 py-1.5 text-xs font-bold text-red-100 disabled:opacity-50 ${interactivePressable}`}
                >
                  Delete
                </button>
              </>
            ) : null}
            {review.state === 'deleted' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRestore(review.id)}
                className={`min-h-9 rounded-full border border-teal-300/50 bg-teal-500/15 px-3 py-1.5 text-xs font-bold text-teal-100 disabled:opacity-50 ${interactivePressable}`}
              >
                Restore
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
