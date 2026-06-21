'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ORDER_SUCCESS_SYNCED_EVENT } from '@/lib/postOrderSuccessSync';
import { ProductImage } from '@/components/images';
import { HeartWishlistButton } from '@/components/wishlist/HeartWishlistButton';
import { productImageAlt } from '@/lib/a11y/productImageAlt';
import { SkeletonProductGrid } from '@/components/skeleton';
import { getProductCardImageUrl } from '@/lib/productColor';
import {
  fetchHomeProducts,
  getHomeProductDiscountPercent,
  productsQueryKey,
  productsStaleTimeMs,
  type HomeProduct,
} from '@/lib/homeProducts';

function ProductsEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-3xl border border-purple-950 bg-[#0d0716] p-6 text-center shadow-[0_18px_50px_rgba(168,85,247,0.18)] sm:p-10">
      <p className="text-lg font-bold text-purple-200 sm:text-xl">
        Collection is getting ready...
      </p>
      <p className="mt-2 text-sm text-gray-400 sm:text-base">
        Please wait a few seconds, then refresh
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-purple-300/60 bg-purple-500/15 px-6 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-300 hover:bg-purple-500/25"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function ProductGrid({ products }: { products: HomeProduct[] }) {
  return (
    <div className="grid items-stretch gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
      {products.map((product, index) => {
        const image = getProductCardImageUrl(product.product_images);
        const sortedImages = [...(product.product_images || [])].sort(
          (a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99),
        );
        const cardImage = sortedImages[0];
        const imageAlt = productImageAlt(cardImage?.alt_text ?? null, product.name);
        const discountPercent = getHomeProductDiscountPercent(
          Number(product.base_price),
          product.sale_price === null ? null : Number(product.sale_price),
        );

        return (
          <div
            key={product.id}
            className="group flex h-full flex-col overflow-hidden rounded-3xl border border-purple-950 bg-[#0d0716] shadow-sm transition duration-300 hover:border-purple-300 hover:shadow-[0_18px_50px_rgba(168,85,247,0.38)] sm:hover:-translate-y-2"
          >
            <div className="relative overflow-hidden">
              <div className="absolute right-2 top-2 z-20 sm:right-3 sm:top-3">
                <HeartWishlistButton
                  productId={product.id}
                  redirectPath={`/product/${product.slug}`}
                  variant="card"
                />
              </div>
              {discountPercent ? (
                <span className="absolute left-3 top-3 z-10 rounded-full border border-red-300/50 bg-red-500/25 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-red-100 shadow-[0_0_25px_rgba(248,113,113,0.35)] backdrop-blur-md sm:left-4 sm:top-4 sm:px-4 sm:py-2 sm:text-xs">
                  {discountPercent}% OFF
                </span>
              ) : null}

              <Link href={`/product/${product.slug}`} className="block">
                {image ? (
                  <div className="relative h-72 w-full overflow-hidden sm:h-80">
                    <ProductImage
                      src={image}
                      alt={imageAlt}
                      variant="catalog"
                      priority={index < 3}
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-72 w-full items-center justify-center bg-[#111827] text-gray-400 sm:h-80"
                    role="img"
                    aria-label={`No image for ${product.name}`}
                  >
                    No image
                  </div>
                )}
              </Link>
            </div>

            <div className="flex flex-1 flex-col p-4 sm:p-5">
              <div className="flex-1">
                <h2 className="line-clamp-1 text-lg font-bold text-white sm:text-xl">
                  {product.name}
                </h2>

                <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-300">
                  {product.description}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                  {discountPercent ? (
                    <>
                      <span className="text-lg font-black text-purple-300 sm:text-xl">
                        EGP {product.sale_price}
                      </span>

                      <span className="text-sm text-gray-500 line-through">
                        EGP {product.base_price}
                      </span>

                      <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-200">
                        Save {discountPercent}%
                      </span>
                    </>
                  ) : (
                    <span className="text-lg font-black text-purple-300 sm:text-xl">
                      EGP {product.base_price}
                    </span>
                  )}
                </div>
              </div>

              <Link
                href={`/product/${product.slug}`}
                className="mt-5 block min-h-12 w-full rounded-full border border-purple-300 bg-purple-300 px-5 py-3 text-center font-bold text-black transition hover:bg-white hover:shadow-[0_0_35px_rgba(168,85,247,0.65)]"
              >
                View Product
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProductCatalog() {
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: productsQueryKey,
    queryFn: fetchHomeProducts,
    staleTime: productsStaleTimeMs,
    placeholderData: keepPreviousData,
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
    return <SkeletonProductGrid count={6} />;
  }

  if (isError) {
    return <ProductsEmptyState onRetry={() => void refetch()} />;
  }

  const products = data ?? [];

  if (products.length === 0 && !isFetching) {
    return <ProductsEmptyState onRetry={() => void refetch()} />;
  }

  if (products.length === 0) {
    return <SkeletonProductGrid count={6} />;
  }

  return <ProductGrid products={products} />;
}
