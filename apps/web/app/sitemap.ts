import type { MetadataRoute } from 'next';
import { fetchHomeProducts } from '@/lib/homeProducts';
import { buildPublicSitemapEntries } from '@/lib/seo/sitemapEntries';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: Awaited<ReturnType<typeof fetchHomeProducts>> = [];

  try {
    products = await fetchHomeProducts();
  } catch {
    products = [];
  }

  return buildPublicSitemapEntries(products);
}
