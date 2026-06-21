'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import BrandLoader from '@/components/BrandLoader';
import Navbar from '@/components/Navbar';
import { PremiumEmptyState } from '@/components/empty-state';
import { ProductImage } from '@/components/images';
import { HeartWishlistButton } from '@/components/wishlist/HeartWishlistButton';
import { AsyncView, SkeletonProductGrid } from '@/components/skeleton';
import { productImageAlt } from '@/lib/a11y/productImageAlt';
import { shouldRefetchCustomerDataOnAuthEvent } from '@/lib/authSession';
import {
  CustomerWishlistAuthRequiredError,
  CustomerWishlistFetchError,
  customerWishlistQueryKey,
  customerWishlistStaleTimeMs,
  fetchCustomerWishlist,
} from '@/lib/customerWishlist';
import { getProductCardImageUrl } from '@/lib/productColor';
import { supabase } from '@/lib/supabaseClient';

export default function AccountWishlistPage() {
  const router = useRouter();
  const [authRequired, setAuthRequired] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (!checkingAuth && authRequired) {
      router.replace('/auth?redirect=/account/wishlist');
    }
  }, [checkingAuth, authRequired, router]);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthRequired(!data.session);
      setCheckingAuth(false);
    }

    void checkAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldRefetchCustomerDataOnAuthEvent(event)) return;
      void checkAuth();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const wishlistQuery = useQuery({
    queryKey: customerWishlistQueryKey,
    queryFn: fetchCustomerWishlist,
    enabled: !checkingAuth && !authRequired,
    staleTime: customerWishlistStaleTimeMs,
    retry: false,
  });

  useEffect(() => {
    if (wishlistQuery.error instanceof CustomerWishlistAuthRequiredError) {
      setAuthRequired(true);
    }
  }, [wishlistQuery.error]);

  if (checkingAuth || authRequired) {
    return <BrandLoader variant="fullscreen" message="LOADING WISHLIST..." />;
  }

  return (
    <main className="min-h-screen bg-[#07030d] px-4 py-8 text-white sm:px-6">
      <Navbar />

      <section className="mx-auto max-w-6xl">
        <header className="mb-8 text-center sm:mb-10">
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-purple-300/80">
            Bunny&apos;s Whisper
          </p>
          <h1 className="mt-3 bg-linear-to-r from-white via-purple-100 to-fuchsia-400 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            My Wishlist
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
            Your saved pieces — tap the heart again to remove.
          </p>
        </header>

        <AsyncView
          loading={wishlistQuery.isPending}
          skeleton={<SkeletonProductGrid count={3} />}
        >
          {wishlistQuery.isError ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {wishlistQuery.error instanceof CustomerWishlistFetchError
                ? wishlistQuery.error.message
                : 'Could not load wishlist.'}
              <button
                type="button"
                onClick={() => void wishlistQuery.refetch()}
                className="ml-3 font-bold underline"
              >
                Retry
              </button>
            </div>
          ) : wishlistQuery.data && wishlistQuery.data.length === 0 ? (
            <PremiumEmptyState
              title="Your wishlist is empty"
              description="Tap the heart on any product to save it here."
              primaryAction={{ label: 'Browse collection', href: '/' }}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {(wishlistQuery.data || []).map((item) => {
                const product = item.product;
                const image = getProductCardImageUrl(product.product_images);
                const cardImage = product.product_images?.[0];
                const imageAlt = productImageAlt(
                  cardImage?.alt_text ?? null,
                  product.name,
                );

                return (
                  <article
                    key={item.wishlistId}
                    className="overflow-hidden rounded-3xl border border-purple-950 bg-[#0d0716] shadow-sm"
                  >
                    <div className="relative">
                      <Link href={`/product/${product.slug}`} className="block">
                        {image ? (
                          <div className="relative h-72 w-full overflow-hidden">
                            <ProductImage
                              src={image}
                              alt={imageAlt}
                              variant="catalog"
                            />
                          </div>
                        ) : (
                          <div className="flex h-72 items-center justify-center bg-[#111827] text-gray-400">
                            No image
                          </div>
                        )}
                      </Link>
                      <div className="absolute right-3 top-3">
                        <HeartWishlistButton productId={product.id} variant="inline" />
                      </div>
                    </div>

                    <div className="p-4 sm:p-5">
                      <h2 className="line-clamp-1 text-lg font-bold text-white">
                        {product.name}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-300">
                        {product.description}
                      </p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-lg font-black text-purple-300">
                          EGP {product.sale_price ?? product.base_price}
                        </span>
                        <Link
                          href={`/product/${product.slug}`}
                          className="rounded-full border border-purple-300/50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-purple-100"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </AsyncView>
      </section>
    </main>
  );
}
