'use client';

import {
  CustomerReviewForm,
  type CustomerReviewFormPayload,
} from '@/components/reviews/CustomerReviewForm';
import { submitPublicReview } from '@/lib/reviewsApi';

type PublicReviewFormProps = {
  onSuccess: (message: string) => void;
};

export function PublicReviewForm({ onSuccess }: PublicReviewFormProps) {
  async function handleSubmit(payload: CustomerReviewFormPayload) {
    const res = await submitPublicReview({
      rating: payload.rating,
      reviewerName: payload.reviewerName,
      reviewerEmail: payload.reviewerEmail,
      reviewerPhoneCountryCode: payload.reviewerPhoneCountryCode,
      reviewerPhone: payload.reviewerPhone,
      reviewText: payload.reviewText,
      publicProductName: payload.publicProductName,
    });
    onSuccess(res.message);
  }

  return <CustomerReviewForm onSubmit={handleSubmit} />;
}
