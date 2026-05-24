export type ReviewModerationState = 'active' | 'pending' | 'hidden' | 'deleted';

export type ReviewSource = 'order_token' | 'public';

export type AdminReplyVisibility = 'public' | 'private';

export type PublicReviewDto = {
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

export type ReviewsPaginationMeta = {
  total: number;
  limit: number;
  offset: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type PublicReviewsListResponse = ReviewsPaginationMeta & {
  reviews: PublicReviewDto[];
};

export type PublicSubmitReviewResponse = {
  success: true;
  message: string;
};

export type ReviewInviteAdminReply = {
  text: string;
  visibility: AdminReplyVisibility;
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

export type ReviewInviteResponse = {
  orderRef: string;
  canSubmit: boolean;
  alreadyReviewed: boolean;
  prefill?: ReviewInvitePrefill;
  myReview?: ReviewInviteMyReview;
};

export type AdminReviewDto = {
  id: string;
  orderRef: string | null;
  rating: number;
  reviewerName: string | null;
  reviewText: string | null;
  createdAt: string;
  state: ReviewModerationState;
  source: ReviewSource;
  isApproved: boolean;
  productNames: string[];
  orderStatus: string | null;
  isHidden: boolean;
  hiddenAt: string | null;
  hiddenBy: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  adminReply: string | null;
  adminReplyVisibility: AdminReplyVisibility;
  adminReplyCreatedAt: string | null;
  adminReplyUpdatedAt: string | null;
  adminReplyBy: string | null;
  reviewerEmail: string | null;
  reviewerPhoneCountryCode: string | null;
  reviewerPhoneRaw: string | null;
  reviewerPhoneNormalized: string | null;
};

export type AdminReviewsListResponse = ReviewsPaginationMeta & {
  reviews: AdminReviewDto[];
};

export type ListReviewsQuery = {
  rating?: number;
  product?: string;
  sort?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
  search?: string;
};

export type ListAdminReviewsQuery = ListReviewsQuery & {
  state?: 'active' | 'pending' | 'hidden' | 'deleted' | 'all';
};
