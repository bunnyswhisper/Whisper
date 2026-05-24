import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/api';
import type { HomeProduct } from '@/lib/homeProducts';
import { legalPolicyLinks } from '@/lib/legal/policyLinks';

/** Homepage is the public product catalog/listing. */
const CATALOG_PATH = '/';

/**
 * Include only products that are safe to index:
 * - valid slug
 * - at least one variant
 * - sellable stock (matches public catalog intent)
 * - deduped by slug (first wins)
 *
 * `/products` API already returns `status=active` featured items only.
 */
export function filterProductsForSitemap(products: HomeProduct[]): HomeProduct[] {
  const seenSlugs = new Set<string>();
  const result: HomeProduct[] = [];

  for (const product of products) {
    const slug = product.slug?.trim();
    if (!slug) continue;

    const key = slug.toLowerCase();
    if (seenSlugs.has(key)) continue;

    const variants = product.product_variants ?? [];
    if (variants.length === 0) continue;

    const totalStock = variants.reduce(
      (sum, v) => sum + Number(v.stock_quantity || 0),
      0,
    );
    if (totalStock <= 0) continue;

    seenSlugs.add(key);
    result.push(product);
  }

  return result;
}

export function buildPublicSitemapEntries(
  products: HomeProduct[],
  lastModified: Date = new Date(),
): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}${CATALOG_PATH}`,
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    ...legalPolicyLinks.map((link) => ({
      url: `${SITE_URL}${link.href}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  const productEntries: MetadataRoute.Sitemap = filterProductsForSitemap(
    products,
  ).map((p) => ({
    url: `${SITE_URL}/product/${encodeURIComponent(p.slug.trim())}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
