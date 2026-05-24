import { SITE_URL, siteUrl } from '@/lib/api';
import type { ProductDetail } from '@/lib/productDetail';
import {
  SEO_ORGANIZATION_SAME_AS,
  SEO_SITE_NAME,
  ogImageUrl,
} from '@/lib/seo/siteConfig';

/** Prevent `</script>` breakout in JSON-LD. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SEO_SITE_NAME,
    url: SITE_URL,
    logo: ogImageUrl(),
    sameAs: [...SEO_ORGANIZATION_SAME_AS],
  };
}

export function buildWebSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO_SITE_NAME,
    url: SITE_URL,
    publisher: {
      '@type': 'Organization',
      name: SEO_SITE_NAME,
      logo: ogImageUrl(),
    },
  };
}

function productImageUrls(product: ProductDetail): string[] {
  const urls = (product.product_images ?? [])
    .map((img) => img.image_url?.trim())
    .filter(Boolean)
    .map((url) => (url.startsWith('http') ? url : siteUrl(url)));

  return urls.length > 0 ? urls : [ogImageUrl()];
}

function productTotalStock(product: ProductDetail): number {
  return (product.product_variants ?? []).reduce(
    (sum, v) => sum + Number(v.stock_quantity || 0),
    0,
  );
}

export function buildProductJsonLd(product: ProductDetail) {
  const price = Number(product.sale_price ?? product.base_price ?? 0);
  const inStock = productTotalStock(product) > 0;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description?.trim() || product.name,
    image: productImageUrls(product),
    sku: product.id,
    productID: product.id,
    brand: {
      '@type': 'Brand',
      name: SEO_SITE_NAME,
    },
    offers: {
      '@type': 'Offer',
      url: siteUrl(`/product/${product.slug}`),
      priceCurrency: 'EGP',
      price: Number.isInteger(price) ? String(price) : price.toFixed(2),
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  };
}
