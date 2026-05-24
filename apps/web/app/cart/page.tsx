'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl } from '@/lib/api';
import { readCart, writeCart } from '@/lib/cartStorage';
import TrustChecklist from '@/components/TrustChecklist';
import { PremiumEmptyState } from '@/components/empty-state';
import { AsyncView, SkeletonCartPage } from '@/components/skeleton';
import { ProductImage } from '@/components/images';
import { productImageAlt } from '@/lib/a11y/productImageAlt';
import {
  fetchHomeProducts,
  productsQueryKey,
  productsStaleTimeMs,
  type HomeProduct,
} from '@/lib/homeProducts';

type CartItem = {
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
};

const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function money(value: number) {
  return `EGP ${Number(value || 0).toFixed(2)}`;
}

function buildStockMap(products: HomeProduct[]): Record<string, number> {
  const nextStockMap: Record<string, number> = {};

  products.forEach((product) => {
    product.product_variants?.forEach((variant) => {
      nextStockMap[variant.id] = Number(variant.stock_quantity || 0);
    });
  });

  return nextStockMap;
}

function computeUpsells(
  currentCart: CartItem[],
  products: HomeProduct[],
): HomeProduct[] {
  const cartProductIds = currentCart.map((item) => item.productId);

  return products
    .filter((product) => !cartProductIds.includes(product.id))
    .filter((product) =>
      product.product_variants?.some(
        (variant) => Number(variant.stock_quantity || 0) > 0,
      ),
    )
    .slice(0, 3);
}

function fixCartAgainstStock(
  currentCart: CartItem[],
  nextStockMap: Record<string, number>,
): { fixedCart: CartItem[]; changed: boolean } {
  let changed = false;

  const fixedCart = currentCart
    .map((item) => {
      const stock = nextStockMap[item.variantId];

      if (stock === undefined) return item;

      if (stock <= 0) {
        changed = true;
        return { ...item, quantity: 0 };
      }

      if (item.quantity > stock) {
        changed = true;
        return { ...item, quantity: stock };
      }

      return item;
    })
    .filter((item) => item.quantity > 0);

  return { fixedCart, changed };
}

function sortVariants(variants: HomeProduct['product_variants']) {
  return [...variants].sort((a, b) => {
    if (a.color !== b.color) return a.color.localeCompare(b.color);

    const sizeA = sizeOrder.indexOf(a.size.toUpperCase());
    const sizeB = sizeOrder.indexOf(b.size.toUpperCase());

    return sizeA - sizeB;
  });
}

export default function CartPage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [upsellProducts, setUpsellProducts] = useState<HomeProduct[]>([]);
  const [upsellMessage, setUpsellMessage] = useState('');
  const [cartMessage, setCartMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'saved'>(
    'idle',
  );
  const [openUpsellProductId, setOpenUpsellProductId] = useState<string | null>(
    null,
  );
  const [cartHydrating, setCartHydrating] = useState(true);
  const [pendingVariantIds, setPendingVariantIds] = useState<Set<string>>(
    () => new Set(),
  );

  const cartReadyRef = useRef(false);
  const initialStockFixDoneRef = useRef(false);

  const productsQuery = useQuery({
    queryKey: productsQueryKey,
    queryFn: fetchHomeProducts,
    staleTime: productsStaleTimeMs,
  });

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  const itemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const hasInvalidItem = useMemo(
    () =>
      cart.some((item) => {
        const stock = stockMap[item.variantId];
        if (stock === undefined) return false;
        return stock <= 0 || item.quantity > stock;
      }),
    [cart, stockMap],
  );

  async function syncAbandonedCart(nextCart: CartItem[]) {
    try {
      setSyncStatus('syncing');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setSyncStatus('idle');
        return;
      }

      await fetch(apiUrl('/abandoned-cart/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ items: nextCart }),
      });

      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 1400);
    } catch {
      setSyncStatus('idle');
    }
  }

  function applyProductsCatalog(
    products: HomeProduct[],
    currentCart: CartItem[],
    options?: { adjustCart?: boolean },
  ) {
    if (products.length === 0) return;

    const nextStockMap = buildStockMap(products);
    setStockMap(nextStockMap);
    setUpsellProducts(computeUpsells(currentCart, products));

    if (!options?.adjustCart) return;

    const { fixedCart, changed } = fixCartAgainstStock(currentCart, nextStockMap);

    if (changed) {
      setCart(fixedCart);
      writeCart(fixedCart);
      syncAbandonedCart(fixedCart);
      setCartMessage('Some cart quantities were adjusted based on available stock.');
      setTimeout(() => setCartMessage(''), 2500);
    }
  }

  function revertCart(snapshot: CartItem[]) {
    setCart(snapshot);
    try {
      writeCart(snapshot);
    } catch {
      /* ignore */
    }
  }

  async function fetchFreshProducts(): Promise<HomeProduct[]> {
    return queryClient.fetchQuery({
      queryKey: productsQueryKey,
      queryFn: fetchHomeProducts,
      staleTime: 0,
    });
  }

  async function reconcileCartStock(
    optimisticCart: CartItem[],
    snapshot: CartItem[],
  ) {
    let products: HomeProduct[];
    try {
      products = await fetchFreshProducts();
    } catch {
      return;
    }

    if (products.length === 0) return;

    const nextStockMap = buildStockMap(products);
    setStockMap(nextStockMap);
    setUpsellProducts(computeUpsells(optimisticCart, products));

    const { fixedCart, changed } = fixCartAgainstStock(optimisticCart, nextStockMap);

    if (!changed) return;

    const optimisticJson = JSON.stringify(optimisticCart);
    const fixedJson = JSON.stringify(fixedCart);

    if (fixedJson === optimisticJson) return;

    if (fixedCart.length === 0 && optimisticCart.length > 0) {
      revertCart(snapshot);
      setCartMessage('Item is no longer available and was removed.');
    } else {
      setCart(fixedCart);
      writeCart(fixedCart);
      setCartMessage('Some cart quantities were adjusted based on available stock.');
    }

    syncAbandonedCart(fixedCart.length ? fixedCart : snapshot);
    setTimeout(() => setCartMessage(''), 2500);
  }

  function saveCart(
    updatedCart: CartItem[],
    message?: string,
    pendingVariantId?: string,
  ) {
    const snapshot = cart;
    try {
      setCart(updatedCart);
      writeCart(updatedCart);
    } catch {
      revertCart(snapshot);
      setCartMessage('Could not update your cart. Please try again.');
      setTimeout(() => setCartMessage(''), 2200);
      if (pendingVariantId) {
        setPendingVariantIds((prev) => {
          const next = new Set(prev);
          next.delete(pendingVariantId);
          return next;
        });
      }
      return;
    }

    const cachedProducts = queryClient.getQueryData<HomeProduct[]>(productsQueryKey);
    if (cachedProducts?.length) {
      setUpsellProducts(computeUpsells(updatedCart, cachedProducts));
    }

    syncAbandonedCart(updatedCart);
    void reconcileCartStock(updatedCart, snapshot).finally(() => {
      if (!pendingVariantId) return;
      setPendingVariantIds((prev) => {
        const next = new Set(prev);
        next.delete(pendingVariantId);
        return next;
      });
    });

    if (message) {
      setCartMessage(message);
      setTimeout(() => setCartMessage(''), 1800);
    }
  }

  function updateQuantity(variantId: string, quantity: number) {
    if (quantity < 1) return;

    const stock = stockMap[variantId];

    if (stock !== undefined && stock <= 0) {
      setCartMessage('This item is currently out of stock.');
      setTimeout(() => setCartMessage(''), 1800);
      return;
    }

    if (stock !== undefined && quantity > stock) {
      setCartMessage(`Only ${stock} piece${stock === 1 ? '' : 's'} available.`);
      setTimeout(() => setCartMessage(''), 1800);
      return;
    }

    setPendingVariantIds((prev) => new Set(prev).add(variantId));
    const updatedCart = cart.map((item) =>
      item.variantId === variantId ? { ...item, quantity } : item,
    );

    saveCart(updatedCart, undefined, variantId);
  }

  function removeItem(variantId: string) {
    setPendingVariantIds((prev) => new Set(prev).add(variantId));
    const updatedCart = cart.filter((item) => item.variantId !== variantId);
    saveCart(updatedCart, 'Item removed from cart.', variantId);
  }

  function clearCart() {
    saveCart([], 'Cart cleared.');
  }

  function addProductVariant(
    product: HomeProduct,
    variant: HomeProduct['product_variants'][number],
  ) {
    const stock = stockMap[variant.id] ?? Number(variant.stock_quantity || 0);

    if (stock <= 0) {
      setCartMessage('This variant is currently out of stock.');
      setTimeout(() => setCartMessage(''), 1800);
      return;
    }

    const item: CartItem = {
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      slug: product.slug,
      image: product.product_images?.[0]?.image_url || '',
      price: product.sale_price || product.base_price,
      size: variant.size,
      color: variant.color,
      quantity: 1,
    };

    const existingItem = cart.find(
      (cartItem) => cartItem.variantId === variant.id,
    );

    if (existingItem && existingItem.quantity >= stock) {
      setCartMessage(`Only ${stock} piece${stock === 1 ? '' : 's'} available.`);
      setTimeout(() => setCartMessage(''), 1800);
      return;
    }

    const updatedCart = existingItem
      ? cart.map((cartItem) =>
          cartItem.variantId === variant.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        )
      : [...cart, item];

    saveCart(updatedCart);
    setUpsellMessage(`${product.name} - ${variant.color} / ${variant.size} added.`);
    setOpenUpsellProductId(null);

    setTimeout(() => setUpsellMessage(''), 2200);
  }

  useEffect(() => {
    const storedCart = readCart() as CartItem[];
    setCart(storedCart);
    syncAbandonedCart(storedCart);
    cartReadyRef.current = true;
  }, []);

  useEffect(() => {
    if (!cartReadyRef.current || initialStockFixDoneRef.current) return;

    if (productsQuery.isPending && productsQuery.data === undefined) return;

    initialStockFixDoneRef.current = true;

    const products = productsQuery.data ?? [];
    if (products.length > 0) {
      applyProductsCatalog(products, cart, { adjustCart: true });
    }

    setCartHydrating(false);
  }, [cart, productsQuery.data, productsQuery.isPending]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2rem,calc(env(safe-area-inset-bottom)+5rem))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <section className="mx-auto max-w-6xl">
        <Navbar />

        <div className="mb-6 flex flex-col gap-3 sm:mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.35em]">
              Bunny&apos;s Whisper
            </p>

            <h1 className="mt-3 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
              Your Cart
            </h1>

            <p className="mt-2 text-sm text-gray-400 sm:text-base">
              Review your selected pieces before checkout.
            </p>
          </div>

          {syncStatus !== 'idle' && (
            <div className="w-fit rounded-full border border-purple-300/30 bg-purple-500/10 px-4 py-2 text-xs text-purple-100 sm:text-sm">
              {syncStatus === 'syncing'
                ? 'Saving your cart...'
                : 'Cart saved for reminders'}
            </div>
          )}
        </div>

        {cartMessage && (
          <div className="mb-5 rounded-2xl border border-green-300/40 bg-green-500/10 p-4 text-sm text-green-200 sm:text-base">
            {cartMessage}
          </div>
        )}

        {cart.length === 0 && !cartHydrating ? (
          <PremiumEmptyState
            eyebrow="Empty Cart"
            title="Your cart is waiting for its first piece."
            description="Explore the collection and add your favorite Bunny's Whisper pieces before they disappear."
            primaryAction={{ label: 'Shop Now', href: '/' }}
            secondaryAction={{ label: 'View Points', href: '/points' }}
          />
        ) : (
          <AsyncView
            loading={cartHydrating && cart.length > 0}
            skeleton={<SkeletonCartPage />}
          >
          <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-8">
            <div className="space-y-4">
              {cart.map((item) => {
                const stock = stockMap[item.variantId];
                const isOutOfStock = stock !== undefined && stock <= 0;
                const isLowStock =
                  stock !== undefined && stock > 0 && stock <= 5;
                const reachedMax =
                  stock !== undefined && item.quantity >= stock;

                const isPending = pendingVariantIds.has(item.variantId);

                return (
                  <div
                    key={item.variantId}
                    className={`group flex flex-col gap-4 rounded-3xl border bg-[#0d0716] p-4 shadow-[0_18px_50px_rgba(168,85,247,0.12)] transition sm:flex-row sm:gap-5 sm:hover:-translate-y-1 sm:hover:shadow-[0_18px_50px_rgba(168,85,247,0.38)] ${
                      isPending ? 'opacity-80' : ''
                    } ${
                      isOutOfStock
                        ? 'border-red-300/50'
                        : isLowStock
                          ? 'border-yellow-300/40'
                          : 'border-purple-950 hover:border-purple-300'
                    }`}
                  >
                    {item.image ? (
                      <Link
                        href={`/product/${item.slug}`}
                        className="block shrink-0"
                      >
                        <span className="relative block h-52 w-full overflow-hidden rounded-2xl sm:h-28 sm:w-28">
                          <ProductImage
                            src={item.image}
                            alt={productImageAlt(null, item.name)}
                            variant="cart"
                            className="transition group-hover:scale-[1.01] sm:group-hover:scale-[1.03]"
                          />
                        </span>
                      </Link>
                    ) : (
                      <div className="flex h-52 w-full shrink-0 items-center justify-center rounded-2xl bg-[#111827] text-xs text-gray-400 sm:h-28 sm:w-28">
                        No image
                      </div>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
                      <div>
                        <Link
                          href={`/product/${item.slug}`}
                          className="line-clamp-2 text-lg font-bold text-white hover:text-purple-200"
                        >
                          {item.name}
                        </Link>

                        <p className="mt-1 text-sm capitalize text-gray-400">
                          {item.color} / {item.size}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {isOutOfStock ? (
                            <p className="inline-block rounded-full border border-red-300/40 bg-red-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-red-200 sm:text-xs">
                              Out of Stock
                            </p>
                          ) : isLowStock ? (
                            <p className="inline-block rounded-full border border-yellow-300/40 bg-yellow-500/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] text-yellow-100 sm:text-xs">
                              Only {stock} left
                            </p>
                          ) : null}
                        </div>

                        <p className="mt-3 font-black text-purple-300">
                          {money(item.price)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex w-fit items-center gap-3 rounded-full border border-purple-950 bg-[#05070d] px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1 || isOutOfStock}
                            aria-label={
                              item.quantity <= 1
                                ? 'Minimum quantity is 1'
                                : isOutOfStock
                                  ? 'Item is out of stock'
                                  : `Decrease quantity of ${item.name}`
                            }
                            className="pointer-events-auto flex h-11 min-h-11 min-w-11 w-11 touch-manipulation items-center justify-center rounded-full border border-purple-300/40 text-lg text-purple-200 transition hover:bg-purple-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span aria-hidden>−</span>
                          </button>

                          <span className="min-w-7 text-center font-bold text-white">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity + 1)
                            }
                            disabled={isOutOfStock || reachedMax}
                            aria-label={
                              isOutOfStock
                                ? 'Out of stock'
                                : reachedMax
                                  ? 'Maximum stock reached'
                                  : `Increase quantity of ${item.name}`
                            }
                            className="pointer-events-auto flex h-11 min-h-11 min-w-11 w-11 touch-manipulation items-center justify-center rounded-full border border-purple-300/40 text-lg text-purple-200 transition hover:bg-purple-300 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <span aria-hidden>+</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <p className="text-lg font-black text-purple-200">
                            {money(item.price * item.quantity)}
                          </p>

                          <button
                            type="button"
                            onClick={() => removeItem(item.variantId)}
                            className="pointer-events-auto rounded-full border border-red-300/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-200 touch-manipulation transition hover:bg-red-300 hover:text-black"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {upsellProducts.length > 0 && (
                <div className="mt-6 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 shadow-[0_18px_50px_rgba(168,85,247,0.12)] sm:p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.3em]">
                        Recommended
                      </p>

                      <h2 className="mt-2 text-2xl font-black text-white">
                        Complete Your Look
                      </h2>
                    </div>

                    <p className="text-sm text-gray-400">
                      Choose the size/color before adding.
                    </p>
                  </div>

                  {upsellMessage && (
                    <div className="mt-4 rounded-xl border border-green-300/40 bg-green-500/10 p-3 text-sm text-green-200">
                      {upsellMessage}
                    </div>
                  )}

                  <div className="mt-5 space-y-3">
                    {upsellProducts.map((product) => {
                      const image = product.product_images?.[0]?.image_url;
                      const price = product.sale_price || product.base_price;
                      const availableVariants = sortVariants(
                        product.product_variants || [],
                      ).filter(
                        (variant) => Number(variant.stock_quantity || 0) > 0,
                      );

                      const isOpen = openUpsellProductId === product.id;

                      return (
                        <div
                          key={product.id}
                          className="rounded-2xl border border-purple-950 bg-[#05070d] p-4"
                        >
                          <div className="flex gap-4">
                            {image ? (
                              <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-xl sm:h-24 sm:w-24">
                                <ProductImage
                                  src={image}
                                  alt={productImageAlt(
                                    product.product_images?.[0]?.alt_text,
                                    product.name,
                                  )}
                                  variant="cartUpsell"
                                />
                              </span>
                            ) : (
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-xs text-gray-400 sm:h-24 sm:w-24">
                                No image
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 font-bold text-white">
                                {product.name}
                              </p>

                              <p className="mt-1 text-sm font-bold text-purple-300">
                                {money(price)}
                              </p>

                              <Link
                                href={`/product/${product.slug}`}
                                className="mt-1 inline-block text-xs text-gray-400 hover:text-purple-200"
                              >
                                View details
                              </Link>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setOpenUpsellProductId(
                                  isOpen ? null : product.id,
                                )
                              }
                              className="pointer-events-auto h-fit shrink-0 touch-manipulation rounded-full bg-purple-300 px-4 py-2 text-sm font-bold text-black transition hover:bg-white sm:text-base"
                            >
                              {isOpen ? 'Close' : 'Add'}
                            </button>
                          </div>

                          {isOpen && (
                            <div className="mt-4 rounded-xl border border-purple-950 bg-[#0d0716] p-4">
                              <p className="text-sm font-bold text-purple-200">
                                Choose size and color
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                {availableVariants.map((variant) => (
                                  <button
                                    key={variant.id}
                                    type="button"
                                    onClick={() =>
                                      addProductVariant(product, variant)
                                    }
                                    className="pointer-events-auto min-h-10 touch-manipulation rounded-full border border-purple-950 bg-[#05070d] px-4 py-2 text-sm text-purple-100 transition hover:border-purple-300 hover:bg-purple-300 hover:text-black"
                                  >
                                    {variant.color} / {variant.size}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <aside className="pointer-events-auto relative z-10 h-fit rounded-3xl border border-purple-950 bg-[#0d0716] p-5 shadow-[0_18px_50px_rgba(168,85,247,0.18)] sm:p-6 lg:sticky lg:top-6">
              <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.3em]">
                Summary
              </p>

              <h2 className="mt-2 text-2xl font-black text-white">
                Order Summary
              </h2>

              <div className="mt-6 space-y-4 border-t border-purple-950 pt-5">
                <div className="flex justify-between text-gray-300">
                  <span>Items</span>
                  <span className="font-bold text-purple-300">{itemCount}</span>
                </div>

                <div className="flex justify-between text-gray-300">
                  <span>Subtotal</span>
                  <span className="font-bold text-purple-300">
                    {money(subtotal)}
                  </span>
                </div>

                {hasInvalidItem && (
                  <div className="rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-sm font-semibold text-red-200">
                    One or more items are unavailable or exceed stock. Please
                    adjust your cart before checkout.
                  </div>
                )}

                <div className="rounded-2xl border border-purple-950 bg-[#05070d] p-4 text-sm text-gray-300">
                  Delivery and coupons will be calculated at checkout.
                </div>
              </div>

              <Link
                href={hasInvalidItem ? '#' : '/checkout'}
                onClick={(e) => {
                  if (hasInvalidItem) {
                    e.preventDefault();
                    setCartMessage('Please fix unavailable items before checkout.');
                    setTimeout(() => setCartMessage(''), 2000);
                  }
                }}
                className={`pointer-events-auto mt-6 block min-h-14 w-full touch-manipulation rounded-full border px-6 py-4 text-center font-black transition ${
                  hasInvalidItem
                    ? 'cursor-not-allowed border-gray-600 bg-gray-700 text-gray-400'
                    : 'border-purple-300 bg-purple-300 text-black hover:bg-white hover:shadow-[0_0_45px_rgba(168,85,247,0.7)] sm:hover:-translate-y-1'
                }`}
              >
                {hasInvalidItem ? 'Fix Cart First' : 'Proceed to Checkout'}
              </Link>

              <button
                type="button"
                onClick={clearCart}
                className="pointer-events-auto mt-3 min-h-12 w-full touch-manipulation rounded-full border border-red-300/30 bg-red-500/10 px-6 py-3.5 text-center font-bold text-red-200 transition hover:bg-red-300 hover:text-black"
              >
                Clear Cart
              </button>

              <TrustChecklist
                items={[
                  'Secure checkout',
                  '2 - 4 day delivery',
                  'Premium quality',
                  'Trusted shopping',
                ]}
              />
            </aside>
          </div>
          </AsyncView>
        )}
      </section>
    </main>
  );
}
