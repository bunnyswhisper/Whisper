import type { QueryClient } from '@tanstack/react-query';
import { clearCart } from '@/lib/cartStorage';
import { customerOrdersQueryKey } from '@/lib/customerOrders';
import { customerPointsQueryKey } from '@/lib/customerPoints';
import { productsQueryKey } from '@/lib/homeProducts';
import { productDetailsQueryKeyPrefix } from '@/lib/productDetail';

export { ACTIVE_CART_KEY as CART_STORAGE_KEY } from '@/lib/cartStorage';

export const ORDER_SUCCESS_SYNCED_EVENT = 'bw-order-success-synced';

export type PostOrderSuccessSource = 'paymob-paid' | 'cod-placed';

export type PostOrderSuccessSyncOptions = {
  queryClient: QueryClient;
  source: PostOrderSuccessSource;
  orderId?: string;
};

const syncedOrderKeys = new Set<string>();

/**
 * Clears persisted cart and refreshes customer-facing TanStack Query caches
 * after backend-confirmed order success (Paymob paid or COD placed).
 */
export async function syncAfterConfirmedOrderSuccess({
  queryClient,
  source,
  orderId,
}: PostOrderSuccessSyncOptions): Promise<void> {
  const dedupeKey = orderId ? `${source}:${orderId}` : source;
  if (syncedOrderKeys.has(dedupeKey)) {
    return;
  }
  syncedOrderKeys.add(dedupeKey);

  if (typeof window !== 'undefined') {
    clearCart();
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ORDER_SUCCESS_SYNCED_EVENT));
  }

  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: customerOrdersQueryKey,
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: productsQueryKey,
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: productDetailsQueryKeyPrefix,
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({
      queryKey: customerPointsQueryKey,
      refetchType: 'all',
    }),
    queryClient.invalidateQueries({ queryKey: ['cart'], refetchType: 'all' }),
  ]);

  await Promise.all([
    queryClient.refetchQueries({
      queryKey: customerOrdersQueryKey,
      type: 'all',
    }),
    queryClient.refetchQueries({
      queryKey: productsQueryKey,
      type: 'all',
    }),
    queryClient.refetchQueries({
      queryKey: productDetailsQueryKeyPrefix,
      type: 'all',
    }),
  ]);
}

export function isCardPaymentMethod(method: string | undefined): boolean {
  const m = String(method || '').toLowerCase();
  return m === 'paymob' || m === 'card';
}

export function isPaymobPaymentConfirmedPaid(
  paymentMethod: string | undefined,
  paymentStatus: string | undefined,
): boolean {
  return (
    isCardPaymentMethod(paymentMethod) &&
    String(paymentStatus || '').toLowerCase() === 'paid'
  );
}
