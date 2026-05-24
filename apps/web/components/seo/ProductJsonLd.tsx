import { JsonLd } from '@/components/seo/JsonLd';
import { buildProductJsonLd } from '@/lib/seo/jsonLd';
import type { ProductDetail } from '@/lib/productDetail';

type ProductJsonLdProps = {
  product: ProductDetail | null;
};

/** Renders Product schema from preloaded data — does not fetch. */
export function ProductJsonLd({ product }: ProductJsonLdProps) {
  if (!product) return null;
  return <JsonLd data={buildProductJsonLd(product)} />;
}
