import { fetchJsonWithBootstrapRetry } from '@/lib/authBootstrap';

export type CustomerOrderItem = {
  id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  total_price: number;
};

export type CustomerOrder = {
  id: string;
  created_at: string;
  customer_name?: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  total: number;
  delivery_fee: number;
  vat_amount?: number | null;
  discount_amount?: number | null;
  coupon_code?: string | null;
  order_items: CustomerOrderItem[];
};

export const customerOrdersQueryKey = ['customer-orders'] as const;
export const customerOrdersStaleTimeMs = 20_000;

export class CustomerOrdersAuthRequiredError extends Error {
  readonly name = 'CustomerOrdersAuthRequiredError';
}

export class CustomerOrdersFetchError extends Error {
  readonly name = 'CustomerOrdersFetchError';
}

export async function fetchCustomerOrderById(
  orderId: string,
): Promise<CustomerOrder | null> {
  const result = await fetchJsonWithBootstrapRetry<CustomerOrder>(
    `/customer/orders/${encodeURIComponent(orderId)}`,
  );

  if (!result.ok) {
    return null;
  }

  return result.data && typeof result.data === 'object' ? result.data : null;
}

export async function fetchCustomerOrders(options?: {
  trackOrderId?: string | null;
}): Promise<CustomerOrder[]> {
  const result = await fetchJsonWithBootstrapRetry<CustomerOrder[]>(
    '/customer/orders?limit=200',
  );

  if (!result.ok) {
    if (result.authRequired) {
      throw new CustomerOrdersAuthRequiredError();
    }
    throw new CustomerOrdersFetchError(
      result.message.trim() ||
        "We couldn't load your orders right now. Please check your connection and try again.",
    );
  }

  return Array.isArray(result.data) ? result.data : [];
}
