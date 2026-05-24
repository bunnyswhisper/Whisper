import type { Metadata } from 'next';
import ProductDetailView from '@/components/product/ProductDetailView';
import { ProductJsonLd } from '@/components/seo/ProductJsonLd';
import { loadProductDetail } from '@/lib/productDetail';
import { indexablePageMetadata } from '@/lib/seo/siteConfig';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProductDetail(slug);

  if (!product) {
    return {
      title: 'Product',
      robots: { index: false, follow: false },
    };
  }

  const description =
    product.description?.trim().slice(0, 160) ||
    `${product.name} — Bunny's Whisper luxury dark streetwear.`;

  return indexablePageMetadata(
    `/product/${product.slug}`,
    product.name,
    description,
  );
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await loadProductDetail(slug);

  return (
    <>
      <ProductJsonLd product={product} />
      <ProductDetailView slug={slug} />
    </>
  );
}
