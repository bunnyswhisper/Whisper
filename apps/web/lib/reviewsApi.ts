import { apiUrl } from '@/lib/api';

export type ReviewInviteAdminReply = {
  text: string;
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string | null;
};

export type ReviewInviteMyReview = {
  rating: number;
  reviewerName: string | null;
  reviewText: string | null;
  createdAt: string;
  adminReply: ReviewInviteAdminReply | null;
};

export type ReviewInvitePrefill = {
  reviewerName: string | null;
  reviewerEmail: string | null;
  reviewerPhoneCountryCode: string | null;
  reviewerPhone: string | null;
  publicProductName: string | null;
};

export type ReviewInvite = {
  orderRef: string;
  canSubmit: boolean;
  alreadyReviewed: boolean;
  prefill?: ReviewInvitePrefill;
  myReview?: ReviewInviteMyReview;
};

export type PublicReview = {
  id: string;
  rating: number;
  reviewerName: string;
  reviewText: string | null;
  createdAt: string;
  orderRef: string | null;
  productNames: string[];
  isVerified: boolean;
  adminPublicReply: string | null;
  adminReplyCreatedAt: string | null;
};

export type PublicSubmitReviewResponse = {
  success: true;
  message: string;
};

export type ReviewsPaginationMeta = {
  total: number;
  limit: number;
  offset: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type PublicReviewsResponse = ReviewsPaginationMeta & {
  reviews: PublicReview[];
};

export type AdminReviewState = 'active' | 'pending' | 'hidden' | 'deleted';

export type AdminReviewSource = 'order_token' | 'public';

export type AdminReview = {
  id: string;
  orderRef: string | null;
  rating: number;
  reviewerName: string | null;
  reviewText: string | null;
  createdAt: string;
  state: AdminReviewState;
  source: AdminReviewSource;
  isApproved: boolean;
  productNames: string[];
  orderStatus: string | null;
  isHidden: boolean;
  hiddenAt: string | null;
  hiddenBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  adminReply: string | null;
  adminReplyVisibility: 'public' | 'private';
  adminReplyCreatedAt: string | null;
  adminReplyUpdatedAt: string | null;
  adminReplyBy: string | null;
  reviewerEmail: string | null;
  reviewerPhoneCountryCode: string | null;
  reviewerPhoneRaw: string | null;
  reviewerPhoneNormalized: string | null;
};

export type AdminReviewsResponse = ReviewsPaginationMeta & {
  reviews: AdminReview[];
};

export type ListReviewsParams = {
  rating?: number;
  product?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
  search?: string;
};

export type ListAdminReviewsParams = ListReviewsParams & {
  state?: 'active' | 'pending' | 'hidden' | 'deleted' | 'all';
};

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchReviewInvite(token: string): Promise<ReviewInvite> {
  const encoded = encodeURIComponent(token);
  const res = await fetch(apiUrl(`/reviews/invite/${encoded}`), {
    cache: 'no-store',
  });

  if (res.status === 404) {
    throw new Error('invalid');
  }

  if (!res.ok) {
    throw new Error('load_failed');
  }

  return res.json() as Promise<ReviewInvite>;
}

export type PublicSubmitReviewPayload = {
  rating: number;
  reviewerName: string;
  reviewerEmail: string;
  reviewerPhoneCountryCode: string;
  reviewerPhone: string;
  reviewText: string;
  publicProductName?: string;
};

export async function submitPublicReview(
  payload: PublicSubmitReviewPayload,
): Promise<PublicSubmitReviewResponse> {
  const res = await fetch(apiUrl('/reviews/public-submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const rawText = await res.text();
  let data: PublicSubmitReviewResponse | Record<string, unknown> = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText) as PublicSubmitReviewResponse;
    } catch {
      data = { raw: rawText };
    }
  }

  if (!res.ok) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[submitPublicReview] failed', {
        status: res.status,
        statusText: res.statusText,
        body: data,
        payload,
      });
    }
    throw new Error('submit_failed');
  }

  return data as PublicSubmitReviewResponse;
}

export type SubmitOrderReviewPayload = {
  token: string;
  rating: number;
  reviewerName: string;
  reviewerEmail: string;
  reviewerPhoneCountryCode: string;
  reviewerPhone: string;
  reviewText: string;
  publicProductName?: string;
};

export async function submitReview(payload: SubmitOrderReviewPayload): Promise<void> {
  const res = await fetch(apiUrl('/reviews/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status === 404) {
    throw new Error('invalid');
  }

  if (res.status === 400) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    const msg = Array.isArray(data.message)
      ? data.message.join(' ')
      : data.message;
    if (msg?.toLowerCase().includes('already')) {
      throw new Error('already_reviewed');
    }
    throw new Error('submit_failed');
  }

  if (!res.ok) {
    throw new Error('submit_failed');
  }
}

export async function fetchPublicReviews(
  params: ListReviewsParams = {},
): Promise<PublicReviewsResponse> {
  const qs = new URLSearchParams();
  if (params.rating) qs.set('rating', String(params.rating));
  if (params.product) qs.set('product', params.product);
  if (params.sort) qs.set('sort', params.sort);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.search) qs.set('search', params.search);

  const res = await fetch(apiUrl(`/reviews?${qs.toString()}`), {
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('load_failed');
  }

  return res.json() as Promise<PublicReviewsResponse>;
}

export async function fetchAdminReviews(
  token: string,
  params: ListAdminReviewsParams = {},
): Promise<AdminReviewsResponse> {
  const qs = new URLSearchParams();
  if (params.state) qs.set('state', params.state);
  if (params.rating) qs.set('rating', String(params.rating));
  if (params.product) qs.set('product', params.product);
  if (params.sort) qs.set('sort', params.sort);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.offset) qs.set('offset', String(params.offset));
  if (params.search) qs.set('search', params.search);

  const res = await fetch(apiUrl(`/admin/reviews?${qs.toString()}`), {
    headers: authHeaders(token),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('admin_load_failed');
  }

  return res.json() as Promise<AdminReviewsResponse>;
}

export async function patchAdminReviewReply(
  token: string,
  id: string,
  body: { adminReply?: string },
): Promise<AdminReview> {
  const res = await fetch(apiUrl(`/admin/reviews/${id}/reply`), {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('patch_failed');
  return res.json() as Promise<AdminReview>;
}

export async function patchAdminReviewHide(
  token: string,
  id: string,
): Promise<AdminReview> {
  const res = await fetch(apiUrl(`/admin/reviews/${id}/hide`), {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('patch_failed');
  return res.json() as Promise<AdminReview>;
}

export async function patchAdminReviewUnhide(
  token: string,
  id: string,
): Promise<AdminReview> {
  const res = await fetch(apiUrl(`/admin/reviews/${id}/unhide`), {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('patch_failed');
  return res.json() as Promise<AdminReview>;
}

export async function patchAdminReviewDelete(
  token: string,
  id: string,
): Promise<AdminReview> {
  const res = await fetch(apiUrl(`/admin/reviews/${id}/delete`), {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('patch_failed');
  return res.json() as Promise<AdminReview>;
}

export async function patchAdminReviewRestore(
  token: string,
  id: string,
): Promise<AdminReview> {
  const res = await fetch(apiUrl(`/admin/reviews/${id}/restore`), {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('patch_failed');
  return res.json() as Promise<AdminReview>;
}

export async function patchAdminReviewApprove(
  token: string,
  id: string,
): Promise<AdminReview> {
  const res = await fetch(apiUrl(`/admin/reviews/${id}/approve`), {
    method: 'PATCH',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('patch_failed');
  return res.json() as Promise<AdminReview>;
}

const REVIEW_DATE_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Deterministic UTC date label — same output on server and client (no locale APIs). */
export function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.getUTCDate();
  const month = REVIEW_DATE_MONTHS[d.getUTCMonth()] ?? '???';
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}
