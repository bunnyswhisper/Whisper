import { cache } from 'react';
import { apiUrl } from '@/lib/api';

export type ProductDetail = {
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

/** Stock-sensitive: keep fresh; order success also invalidates via postOrderSuccessSync. */
export const productStaleTimeMs = 0;

/** Prefix for invalidating all product detail queries after confirmed orders. */
export const productDetailsQueryKeyPrefix = ['product'] as const;

export function productQueryKey(slug: string) {
  return [...productDetailsQueryKeyPrefix, slug] as const;
}

export async function fetchProductDetail(slug: string): Promise<ProductDetail | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(apiUrl(`/products/${slug}`), {
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) return null;

    return res.json();
  } catch {
    // Network failure, abort, invalid JSON — never throw for SEO/page stability.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Server/RSC: one fetch per slug per request (metadata + JSON-LD + page). */
export const loadProductDetail = cache(fetchProductDetail);

export function getProductDiscountPercent(
  basePrice: number,
  salePrice: number | null,
) {
  if (!salePrice || salePrice >= basePrice) return null;
  return Math.round(((basePrice - salePrice) / basePrice) * 100);
}
