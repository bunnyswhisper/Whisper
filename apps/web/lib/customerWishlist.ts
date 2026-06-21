import { fetchJsonWithBootstrapRetry } from '@/lib/authBootstrap';
import { createInflightDedupe } from '@/lib/inflightDedupe';
import type { HomeProduct } from '@/lib/homeProducts';

export const customerWishlistIdsQueryKey = ['customer-wishlist-ids'] as const;
export const customerWishlistQueryKey = ['customer-wishlist'] as const;
export const customerWishlistStaleTimeMs = 30_000;

export class CustomerWishlistAuthRequiredError extends Error {
  readonly name = 'CustomerWishlistAuthRequiredError';
}

export class CustomerWishlistFetchError extends Error {
  readonly name = 'CustomerWishlistFetchError';
}

export type WishlistToggleResult = {
  wishlisted: boolean;
  firstWishlistRewardGranted: boolean;
  pointsAwarded: number;
  pointsBalance: number;
};

export type WishlistItem = {
  wishlistId: string;
  addedAt: string;
  product: HomeProduct;
};

function normalizeWishlistToggleResult(data: unknown): WishlistToggleResult {
  const row =
    data && typeof data === 'object'
      ? (data as Record<string, unknown>)
      : {};

  return {
    wishlisted: Boolean(row.wishlisted),
    firstWishlistRewardGranted: Boolean(
      row.firstWishlistRewardGranted ?? row.first_wishlist_reward_granted,
    ),
    pointsAwarded: Number(row.pointsAwarded ?? row.points_awarded ?? 0),
    pointsBalance: Number(row.pointsBalance ?? row.points_balance ?? 0),
  };
}

const dedupeWishlistIdsFetch = createInflightDedupe<string[]>();

async function fetchCustomerWishlistIdsInternal(): Promise<string[]> {
  const result = await fetchJsonWithBootstrapRetry<{ productIds: string[] }>(
    '/customer/wishlist/ids',
  );

  if (!result.ok) {
    if (result.authRequired) throw new CustomerWishlistAuthRequiredError();
    throw new CustomerWishlistFetchError(
      result.message || 'Could not load wishlist.',
    );
  }

  return Array.isArray(result.data?.productIds) ? result.data.productIds : [];
}

export async function fetchCustomerWishlistIds(): Promise<string[]> {
  return dedupeWishlistIdsFetch(fetchCustomerWishlistIdsInternal);
}

export async function fetchCustomerWishlist(): Promise<WishlistItem[]> {
  const result = await fetchJsonWithBootstrapRetry<{ items: WishlistItem[] }>(
    '/customer/wishlist',
  );

  if (!result.ok) {
    if (result.authRequired) throw new CustomerWishlistAuthRequiredError();
    throw new CustomerWishlistFetchError(
      result.message || 'Could not load wishlist.',
    );
  }

  return Array.isArray(result.data?.items) ? result.data.items : [];
}

export async function toggleCustomerWishlist(
  productId: string,
): Promise<WishlistToggleResult> {
  const result = await fetchJsonWithBootstrapRetry<WishlistToggleResult>(
    '/customer/wishlist/toggle',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    },
  );

  if (!result.ok) {
    if (result.authRequired) throw new CustomerWishlistAuthRequiredError();
    throw new CustomerWishlistFetchError(
      result.message || 'Could not update wishlist.',
    );
  }

  return normalizeWishlistToggleResult(result.data);
}
