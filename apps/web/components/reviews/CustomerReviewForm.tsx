'use client';

import { useEffect, useState } from 'react';
import { InteractiveStarRating } from '@/components/reviews/InteractiveStarRating';
import { MountedOnly } from '@/components/reviews/MountedOnly';
import {
  DEFAULT_REVIEW_PHONE_COUNTRY,
  REVIEW_PHONE_COUNTRY_OPTIONS,
  type ReviewPhoneCountryCode,
} from '@/lib/reviewPhone';
import { interactivePressable } from '@/lib/interactivePressable';

export type CustomerReviewFormInitial = {
  rating?: number;
  reviewerName?: string;
  reviewerEmail?: string;
  phoneCountryCode?: ReviewPhoneCountryCode;
  reviewerPhone?: string;
  productName?: string;
  reviewText?: string;
};

export type CustomerReviewFormPayload = {
  rating: number;
  reviewerName: string;
  reviewerEmail: string;
  reviewerPhoneCountryCode: ReviewPhoneCountryCode;
  reviewerPhone: string;
  publicProductName?: string;
  reviewText: string;
};

type CustomerReviewFormProps = {
  initial?: CustomerReviewFormInitial;
  submitLabel?: string;
  onSubmit: (payload: CustomerReviewFormPayload) => Promise<void>;
  /** Return empty string to suppress the default error banner (e.g. after redirecting UI). */
  onSubmitError?: (error: unknown) => string | null;
};

function CustomerReviewFormFields({
  initial,
  submitLabel = 'Submit review',
  onSubmit,
  onSubmitError,
}: CustomerReviewFormProps) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewerName, setReviewerName] = useState(initial?.reviewerName ?? '');
  const [reviewerEmail, setReviewerEmail] = useState(initial?.reviewerEmail ?? '');
  const [phoneCountryCode, setPhoneCountryCode] = useState<ReviewPhoneCountryCode>(
    initial?.phoneCountryCode ?? DEFAULT_REVIEW_PHONE_COUNTRY,
  );
  const [reviewerPhone, setReviewerPhone] = useState(initial?.reviewerPhone ?? '');
  const [productName, setProductName] = useState(initial?.productName ?? '');
  const [reviewText, setReviewText] = useState(initial?.reviewText ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const errorId = 'customer-review-submit-error';

  useEffect(() => {
    if (initial?.reviewerName) setReviewerName(initial.reviewerName);
    if (initial?.reviewerEmail) setReviewerEmail(initial.reviewerEmail);
    if (initial?.phoneCountryCode) setPhoneCountryCode(initial.phoneCountryCode);
    if (initial?.reviewerPhone) setReviewerPhone(initial.reviewerPhone);
    if (initial?.productName) setProductName(initial.productName);
    if (initial?.rating) setRating(initial.rating);
    if (initial?.reviewText) setReviewText(initial.reviewText);
  }, [initial]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setSubmitError('Please choose a star rating.');
      return;
    }
    const name = reviewerName.trim();
    const email = reviewerEmail.trim();
    const phone = reviewerPhone.trim();
    const text = reviewText.trim();

    if (!name) {
      setSubmitError('Please enter your display name.');
      return;
    }
    if (!email) {
      setSubmitError('Please enter your email address.');
      return;
    }
    if (!phone) {
      setSubmitError('Please enter your phone number.');
      return;
    }
    if (text.length < 5) {
      setSubmitError('Please write at least a few words about your experience.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      await onSubmit({
        rating,
        reviewerName: name,
        reviewerEmail: email,
        reviewerPhoneCountryCode: phoneCountryCode,
        reviewerPhone: phone,
        publicProductName: productName.trim() || undefined,
        reviewText: text,
      });
    } catch (err) {
      const custom = onSubmitError?.(err);
      if (custom === '') {
        setSubmitError('');
      } else {
        setSubmitError(
          custom ?? 'Could not submit your review. Please try again in a moment.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-6"
      noValidate
      aria-label="Review form"
    >
      <div>
        <label
          htmlFor="reviewer-name"
          className="text-sm font-semibold text-purple-100"
        >
          Your name <span className="text-purple-400">*</span>
        </label>
        <input
          id="reviewer-name"
          name="reviewerName"
          type="text"
          required
          maxLength={80}
          autoComplete="name"
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          disabled={submitting}
          placeholder="How we should show your name"
          aria-describedby={submitError ? errorId : undefined}
          className="mt-2 min-h-11 w-full rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300 disabled:opacity-50"
        />
      </div>

      <div>
        <label
          htmlFor="reviewer-email"
          className="text-sm font-semibold text-purple-100"
        >
          Email <span className="text-purple-400">*</span>
        </label>
        <input
          id="reviewer-email"
          name="reviewerEmail"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          value={reviewerEmail}
          onChange={(e) => setReviewerEmail(e.target.value)}
          disabled={submitting}
          placeholder="you@example.com"
          aria-describedby={submitError ? errorId : undefined}
          className="mt-2 min-h-11 w-full rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300 disabled:opacity-50"
        />
        <p className="mt-1.5 text-xs text-gray-500">
          For moderation only — never shown publicly.
        </p>
      </div>

      <div>
        <span
          id="reviewer-phone-label"
          className="text-sm font-semibold text-purple-100"
        >
          Phone <span className="text-purple-400">*</span>
        </span>
        <div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row">
          <div className="min-w-0 sm:w-[11.5rem] sm:shrink-0">
            <label htmlFor="reviewer-phone-country" className="sr-only">
              Country code
            </label>
            <select
              id="reviewer-phone-country"
              name="reviewerPhoneCountryCode"
              value={phoneCountryCode}
              onChange={(e) =>
                setPhoneCountryCode(e.target.value as ReviewPhoneCountryCode)
              }
              disabled={submitting}
              aria-labelledby="reviewer-phone-label"
              className="min-h-11 w-full rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2 text-sm text-white outline-none focus:border-purple-300 disabled:opacity-50"
            >
              {REVIEW_PHONE_COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="reviewer-phone" className="sr-only">
              Phone number
            </label>
            <input
              id="reviewer-phone"
              name="reviewerPhone"
              type="tel"
              required
              maxLength={32}
              autoComplete="tel-national"
              value={reviewerPhone}
              onChange={(e) => setReviewerPhone(e.target.value)}
              disabled={submitting}
              placeholder="e.g. 01120005403"
              aria-labelledby="reviewer-phone-label"
              className="min-h-11 w-full rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300 disabled:opacity-50"
            />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          For moderation only — never shown publicly.
        </p>
      </div>

      <fieldset className="min-w-0 border-0 p-0">
        <legend
          id="rating-legend"
          className="text-sm font-semibold text-purple-100"
        >
          Rating <span className="text-purple-400">*</span>
        </legend>
        <div className="mt-3">
          <InteractiveStarRating
            rating={rating}
            hoverRating={hoverRating}
            onSelect={setRating}
            onHover={setHoverRating}
            onHoverEnd={() => setHoverRating(0)}
            disabled={submitting}
            labelledBy="rating-legend"
          />
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="product-name"
          className="text-sm font-semibold text-purple-100"
        >
          Product <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <input
          id="product-name"
          name="publicProductName"
          type="text"
          maxLength={120}
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          disabled={submitting}
          placeholder="e.g. Whisper Hoodie"
          className="mt-2 min-h-11 w-full rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300 disabled:opacity-50"
        />
      </div>

      <div>
        <label
          htmlFor="review-text"
          className="text-sm font-semibold text-purple-100"
        >
          Your review <span className="text-purple-400">*</span>
        </label>
        <textarea
          id="review-text"
          name="reviewText"
          required
          rows={5}
          maxLength={2000}
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          disabled={submitting}
          placeholder="Tell us about fit, quality, delivery, or style…"
          aria-describedby={submitError ? errorId : undefined}
          className="mt-2 w-full resize-y rounded-xl border border-purple-950 bg-[#05070d] px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-purple-300 disabled:opacity-50"
        />
      </div>

      {submitError ? (
        <p
          id={errorId}
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-100"
        >
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        name="submitReview"
        disabled={submitting}
        className={`min-h-12 w-full rounded-full border border-purple-300 bg-purple-300 px-8 py-3 text-sm font-bold text-black hover:bg-white disabled:opacity-50 ${interactivePressable}`}
      >
        {submitting ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}

function CustomerReviewFormSkeleton() {
  return (
    <div className="mt-8 space-y-6" aria-hidden>
      <div className="h-11 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="h-11 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="h-11 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="h-14 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="h-11 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="h-32 animate-pulse rounded-xl bg-purple-950/40" />
      <div className="h-12 animate-pulse rounded-full bg-purple-950/40" />
    </div>
  );
}

export function CustomerReviewForm(props: CustomerReviewFormProps) {
  return (
    <MountedOnly fallback={<CustomerReviewFormSkeleton />}>
      <CustomerReviewFormFields {...props} />
    </MountedOnly>
  );
}
