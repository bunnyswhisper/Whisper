import { cache } from 'react';
import { apiUrl } from '@/lib/api';
import { createInflightDedupe } from '@/lib/inflightDedupe';
import { productsPublicRevalidateSeconds } from '@/lib/homeProducts';

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

/** Public product detail — brief client cache; invalidated after confirmed orders. */
export const productStaleTimeMs = 60_000;

/** Prefix for invalidating all product detail queries after confirmed orders. */
export const productDetailsQueryKeyPrefix = ['product'] as const;

const dedupeBySlug = new Map<string, ReturnType<typeof createInflightDedupe<ProductDetail | null>>>();

function getProductDetailDedupe(slug: string) {
  let deduper = dedupeBySlug.get(slug);
  if (!deduper) {
    deduper = createInflightDedupe<ProductDetail | null>();
    dedupeBySlug.set(slug, deduper);
  }
  return deduper;
}

export function productQueryKey(slug: string) {
  return [...productDetailsQueryKeyPrefix, slug] as const;
}

async function fetchProductDetailInternal(
  slug: string,
): Promise<ProductDetail | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(apiUrl(`/products/${slug}`), {
      signal: controller.signal,
      next: { revalidate: productsPublicRevalidateSeconds },
    });

    if (!res.ok) return null;

    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchProductDetail(
  slug: string,
): Promise<ProductDetail | null> {
  return getProductDetailDedupe(slug)(() => fetchProductDetailInternal(slug));
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
