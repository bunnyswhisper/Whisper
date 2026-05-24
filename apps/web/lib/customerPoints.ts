import { fetchJsonWithBootstrapRetry } from '@/lib/authBootstrap';
import { friendlyCustomerMessage } from '@/lib/customerMessages';

export type PointsTier = { points: number; discount: number };

export type SavedCoupon = {
  id: string;
  code: string;
  discount_percent: number;
  points_cost: number;
  created_at: string;
  expires_at?: string | null;
};

export type CustomerPointsMe = {
  points: number;
  lifetimePoints: number;
  tiers: PointsTier[];
  coupons: SavedCoupon[];
};

export const customerPointsQueryKey = ['customer-points'] as const;
export const customerCouponsQueryKey = ['customer-coupons'] as const;
export const customerPointsStaleTimeMs = 30_000;

export class CustomerPointsAuthRequiredError extends Error {
  readonly name = 'CustomerPointsAuthRequiredError';
}

export class CustomerPointsFetchError extends Error {
  readonly name = 'CustomerPointsFetchError';
}

export async function fetchCustomerPointsMe(): Promise<CustomerPointsMe> {
  const result = await fetchJsonWithBootstrapRetry<{
    points?: unknown;
    lifetimePoints?: unknown;
    tiers?: unknown;
    coupons?: unknown;
    message?: unknown;
  }>('/points/me');

  if (!result.ok) {
    if (result.authRequired) {
      throw new CustomerPointsAuthRequiredError();
    }
    throw new CustomerPointsFetchError(
      friendlyCustomerMessage(result.message) ||
        "Couldn't load your Bunny Points. Check your connection and try again.",
    );
  }

  const data = result.data;

  return {
    points: Number(data.points) || 0,
    lifetimePoints: Number(data.lifetimePoints) || 0,
    tiers: Array.isArray(data.tiers) ? (data.tiers as PointsTier[]) : [],
    coupons: Array.isArray(data.coupons) ? (data.coupons as SavedCoupon[]) : [],
  };
}
