'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AddToCartButton from '@/components/AddToCartButton';
import { HeartWishlistButton } from '@/components/wishlist/HeartWishlistButton';
import Navbar from '@/components/Navbar';
import { ProductGallery } from '@/components/ProductGallery';
import TrustChecklist from '@/components/TrustChecklist';
import { PremiumEmptyState } from '@/components/empty-state';
import { SkeletonProductDetail, SkeletonReveal } from '@/components/skeleton';
import { ORDER_SUCCESS_SYNCED_EVENT } from '@/lib/postOrderSuccessSync';
import {
  fetchProductDetail,
  getProductDiscountPercent,
  productQueryKey,
  productStaleTimeMs,
  type ProductDetail,
} from '@/lib/productDetail';
import {
  getDefaultProductColor,
  getProductCardImageUrl,
  resolveGalleryForColor,
} from '@/lib/productColor';

const mainClassName =
  'min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-6 text-white sm:px-6 sm:py-8';

function ProductDetailError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className={mainClassName}>
      <Navbar />
      
        <PremiumEmptyState
          variant="error"
          showMark={false}
          eyebrow="Could not load product"
          title="This piece didn't load"
          description="Check your connection and try again."
          primaryAction={{ label: 'Retry', onClick: onRetry }}
          secondaryAction={{ label: 'Back to Collection', href: '/' }}
        />
      
    </main>
  );
}

function ProductNotFound() {
  return (
    <main className={mainClassName}>
      <Navbar />
      
        <PremiumEmptyState
          variant="search"
          eyebrow="Product not found"
          title="This piece is unavailable."
          description="It may have sold out or moved. Explore what's still in the collection."
          primaryAction={{ label: 'Back to Collection', href: '/' }}
        />
      
    </main>
  );
}

function ProductDetailContent({ product }: { product: ProductDetail }) {
  const fallbackGalleryImage = getProductCardImageUrl(product.product_images);
  const defaultColor = getDefaultProductColor(
    product.product_variants,
    product.product_images,
  );
  const initialGallery = resolveGalleryForColor(
    product.product_images,
    defaultColor,
  );
  const [selectedColor, setSelectedColor] = useState(defaultColor);
  const [galleryImage, setGalleryImage] = useState<string | undefined>(() => {
    if (initialGallery.noImagesForSelectedColor) return undefined;
    if (!defaultColor.trim()) {
      return (
        initialGallery.images[0]?.image_url ||
        fallbackGalleryImage ||
        undefined
      );
    }
    return initialGallery.images[0]?.image_url || undefined;
  });

  const galleryResult = resolveGalleryForColor(
    product.product_images,
    selectedColor,
  );
  const galleryImages = galleryResult.images.map((image) => ({
    image_url: image.image_url,
    alt_text: image.alt_text ?? null,
  }));

  useEffect(() => {
    setSelectedColor(
      getDefaultProductColor(product.product_variants, product.product_images),
    );
  }, [product.id]);

  useEffect(() => {
    const color = (
      selectedColor ||
      getDefaultProductColor(product.product_variants, product.product_images)
    ).trim();
    const result = resolveGalleryForColor(product.product_images, color);
    if (result.noImagesForSelectedColor) {
      setGalleryImage(undefined);
      return;
    }
    if (!color || result.status === 'default') {
      setGalleryImage(
        result.images[0]?.image_url || fallbackGalleryImage || undefined,
      );
      return;
    }
    setGalleryImage(result.images[0]?.image_url || undefined);
  }, [selectedColor, product.id, fallbackGalleryImage, product.product_images]);

  function handleColorChange(color: string, _imageUrl: string | null) {
    setSelectedColor(color);
    const result = resolveGalleryForColor(product.product_images, color);
    setGalleryImage(
      result.noImagesForSelectedColor
        ? undefined
        : result.images[0]?.image_url || undefined,
    );
  }

  const discountPercent = getProductDiscountPercent(
    Number(product.base_price),
    product.sale_price === null ? null : Number(product.sale_price),
  );

  const totalStock = product.product_variants.reduce(
    (sum, variant) => sum + Number(variant.stock_quantity || 0),
    0,
  );

  const isLowStock = totalStock > 0 && totalStock <= 5;
  const isOutOfStock = totalStock <= 0;

  return (
    <main className={mainClassName}>
      <Navbar />

      <section className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.95fr]">
        <div className="pointer-events-auto min-w-0">
          <ProductGallery
            key={`${product.id}-${selectedColor.trim().toLowerCase()}`}
            images={galleryImages}
            productName={product.name}
            activeImageFromVariant={galleryImage}
            noImagesForColor={galleryResult.noImagesForSelectedColor}
            selectedColorName={selectedColor}
          />
        </div>

        <div className="pointer-events-auto relative min-w-0 overflow-visible rounded-3xl border border-purple-900/60 bg-[#0d0716] p-5 shadow-[0_18px_60px_rgba(168,85,247,0.2)] sm:p-6 lg:sticky lg:top-10 lg:p-8">
          <div className="flex items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black leading-tight text-transparent sm:text-4xl">
              {product.name}
            </h1>
            <HeartWishlistButton
              productId={product.id}
              redirectPath={`/product/${product.slug}`}
              variant="detail"
              className="shrink-0"
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {discountPercent ? (
              <span className="rounded-full border border-red-300/40 bg-red-500/15 px-4 py-2 text-sm font-black text-red-200">
                {discountPercent}% OFF
              </span>
            ) : null}

            {isOutOfStock ? (
              <span className="rounded-full border border-red-300/40 bg-red-500/15 px-4 py-2 text-sm font-black text-red-200">
                Out of Stock
              </span>
            ) : isLowStock ? (
              <span className="rounded-full border border-yellow-300/40 bg-yellow-500/15 px-4 py-2 text-sm font-black text-yellow-100">
                Only {totalStock} Left
              </span>
            ) : (
              <span className="rounded-full border border-green-300/40 bg-green-500/15 px-4 py-2 text-sm font-black text-green-100">
                In Stock
              </span>
            )}
          </div>

          <div className="mt-6 flex items-end gap-4">
            {discountPercent ? (
              <>
                <span className="text-4xl font-black text-purple-300">
                  EGP {product.sale_price}
                </span>

                <span className="text-lg text-gray-500 line-through">
                  EGP {product.base_price}
                </span>
              </>
            ) : (
              <span className="text-4xl font-black text-purple-300">
                EGP {product.base_price}
              </span>
            )}
          </div>

          <p className="mt-6 text-gray-300 leading-8">{product.description}</p>

          <TrustChecklist
            items={[
              'Secure checkout',
              '2 - 4 day delivery',
              'Premium quality',
              'Limited stock - grab yours early',
            ]}
          />

          <div className="mt-8">
            <AddToCartButton
              product={product}
              selectedColor={selectedColor}
              onSelectedColorChange={handleColorChange}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ProductDetailView({ slug }: { slug: string }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: productQueryKey(slug),
    queryFn: () => fetchProductDetail(slug),
    staleTime: productStaleTimeMs,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    const onOrderSuccessSynced = () => {
      void refetch();
    };
    window.addEventListener(ORDER_SUCCESS_SYNCED_EVENT, onOrderSuccessSynced);
    return () =>
      window.removeEventListener(
        ORDER_SUCCESS_SYNCED_EVENT,
        onOrderSuccessSynced,
      );
  }, [refetch]);

  if (isPending && data === undefined) {
    return (
      <main className={mainClassName}>
        <section className="mx-auto max-w-6xl">
          <Navbar />
          <SkeletonProductDetail />
        </section>
      </main>
    );
  }

  if (isError) {
    return <ProductDetailError onRetry={() => void refetch()} />;
  }

  if (data === null || data === undefined) {
    return <ProductNotFound />;
  }

  return (
    <SkeletonReveal>
      <ProductDetailContent product={data} />
    </SkeletonReveal>
  );
}
