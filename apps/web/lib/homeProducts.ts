import { apiUrl } from '@/lib/api';

export type HomeProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  base_price: number;
  sale_price: number | null;
  product_images: {
    image_url: string;
    alt_text: string | null;
    color_name?: string | null;
    sort_order?: number;
  }[];
  product_variants: {
    id: string;
    size: string;
    color: string;
    color_hex?: string | null;
    stock_quantity: number;
  }[];
};

export const productsQueryKey = ['products'] as const;

/** Stock-sensitive: invalidated after confirmed orders via postOrderSuccessSync. */
export const productsStaleTimeMs = 0;

export async function fetchHomeProducts(): Promise<HomeProduct[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(apiUrl('/products'), {
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return [];
    return res.json();
  } catch {
    clearTimeout(timeout);
    return [];
  }
}

export function getHomeProductDiscountPercent(
  basePrice: number,
  salePrice: number | null,
) {
  if (!salePrice || salePrice >= basePrice) return null;
  return Math.round(((basePrice - salePrice) / basePrice) * 100);
}
