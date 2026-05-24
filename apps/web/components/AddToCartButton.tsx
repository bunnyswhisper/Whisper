'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LiveRegion } from '@/components/a11y/LiveRegion';
import { ProductImage } from '@/components/images';
import { InfoPopover } from '@/components/InfoPopover';
import { productImageAlt } from '@/lib/a11y/productImageAlt';
import { readCart, writeCart } from '@/lib/cartStorage';
import { HELP } from '@/lib/helpTips';
import {
  colorsMatch,
  getGalleryMainImageForColor,
  getProductImageForColor,
  getVariantColorHexForName,
  sortProductColorsForDisplay,
} from '@/lib/productColor';

type Variant = {
  id: string;
  size: string;
  color: string;
  color_hex?: string | null;
  stock_quantity: number;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  sale_price: number | null;
  product_images: {
    image_url: string;
    alt_text: string | null;
    color_name?: string | null;
  }[];
  product_variants: Variant[];
};

const sizes = ['S', 'M', 'L', 'XL'];

export default function AddToCartButton({
  product,
  selectedColor: selectedColorProp,
  onSelectedColorChange,
  onColorImageChange,
}: {
  product: Product;
  selectedColor?: string;
  onSelectedColorChange?: (color: string, imageUrl: string | null) => void;
  /** @deprecated Use onSelectedColorChange */
  onColorImageChange?: (imageUrl: string | null) => void;
}) {
  const colors = useMemo(
    () =>
      sortProductColorsForDisplay(
        product.product_variants,
        product.product_images,
      ),
    [product.product_variants, product.product_images],
  );

  const [selectedColorInternal, setSelectedColorInternal] = useState(
    () => colors[0] || '',
  );
  const selectedColor = selectedColorProp ?? selectedColorInternal;

  useEffect(() => {
    if (selectedColorProp !== undefined) return;
    setSelectedColorInternal(colors[0] || '');
  }, [product.id, colors, selectedColorProp]);

  function selectColor(color: string) {
    const url = getGalleryMainImageForColor(product.product_images, color);
    if (selectedColorProp === undefined) {
      setSelectedColorInternal(color);
    }
    onSelectedColorChange?.(color, url);
    onColorImageChange?.(url);
  }
  const [selectedSize, setSelectedSize] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const fallbackImage = product.product_images?.[0]?.image_url || '';

  function imageForColor(color: string) {
    return getProductImageForColor(
      product.product_images,
      color,
      fallbackImage,
    );
  }

  const selectedImage = imageForColor(selectedColor);

  const availableVariantsForColor = product.product_variants.filter((variant) =>
    colorsMatch(variant.color, selectedColor),
  );

  const selectedVariant = product.product_variants.find(
    (variant) =>
      colorsMatch(variant.color, selectedColor) &&
      variant.size.trim().toUpperCase() === selectedSize.trim().toUpperCase(),
  );

  const selectedVariantInStock =
    !!selectedVariant && Number(selectedVariant.stock_quantity || 0) > 0;

  const totalColorStock = availableVariantsForColor.reduce(
    (sum, variant) => sum + Number(variant.stock_quantity || 0),
    0,
  );

  function addToCart() {
    setSuccess(false);

    if (!selectedColor) {
      setMessage('Please choose a color first.');
      return;
    }

    if (!selectedSize) {
      setMessage('Please choose a size first.');
      return;
    }

    if (!selectedVariant || !selectedVariantInStock) {
      setMessage('This size/color is out of stock.');
      return;
    }

    const cart = readCart();

    const existingItem = cart.find(
      (cartItem: any) => cartItem.variantId === selectedVariant.id,
    );

    if (
      existingItem &&
      Number(existingItem.quantity || 0) >= selectedVariant.stock_quantity
    ) {
      setMessage(
        `Only ${selectedVariant.stock_quantity} piece${
          selectedVariant.stock_quantity === 1 ? '' : 's'
        } available.`,
      );
      return;
    }

    const item = {
      productId: product.id,
      variantId: selectedVariant.id,
      name: product.name,
      slug: product.slug,
      image: selectedImage,
      price: product.sale_price || product.base_price,
      size: selectedVariant.size,
      color: selectedVariant.color,
      quantity: 1,
    };

    const updatedCart = existingItem
      ? cart.map((cartItem: any) =>
          cartItem.variantId === selectedVariant.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        )
      : [...cart, item];

    try {
      writeCart(updatedCart);
    } catch {
      setMessage('Could not add to cart. Please try again.');
      return;
    }

    setSuccess(true);
    setMessage('Added to cart successfully.');

  }

  return (
    <div className="mt-8">
      <div role="group" aria-labelledby="add-to-cart-color-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="add-to-cart-color-heading" className="font-semibold text-white">
            Choose Color
          </h2>

          {selectedColor && (
            <p className="text-sm font-semibold capitalize text-purple-300">
              {selectedColor}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 pb-10">
          {colors.map((color) => {
            const variantsForColor = product.product_variants.filter((variant) =>
              colorsMatch(variant.color, color),
            );

            const colorStock = variantsForColor.reduce(
              (sum, variant) => sum + Number(variant.stock_quantity || 0),
              0,
            );

            const outOfStock = colorStock <= 0;

            return (
              <button
                key={color}
                type="button"
                disabled={outOfStock}
                title={outOfStock ? `Sold out in ${color}` : undefined}
                aria-label={
                  outOfStock
                    ? `Sold out in ${color}`
                    : `Select ${color} color`
                }
                aria-pressed={colorsMatch(selectedColor, color)}
                onClick={() => {
                  selectColor(color);
                  setSelectedSize('');
                  setMessage('');
                  setSuccess(false);
                }}
                className={`group pointer-events-auto relative flex h-14 w-14 min-h-[3.25rem] min-w-[3.25rem] touch-manipulation items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 sm:hover:-translate-y-1 ${
                  colorsMatch(selectedColor, color)
                    ? 'border-purple-300 shadow-[0_0_25px_rgba(168,85,247,0.7)]'
                    : 'border-purple-950 hover:border-purple-300'
                }`}
              >
                <span
                  className="h-8 w-8 rounded-lg border border-white/40"
                  style={{
                    backgroundColor: getVariantColorHexForName(
                      product.product_variants,
                      color,
                    ),
                  }}
                />

                {outOfStock ? (
                  <span
                    className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden max-w-[14rem] -translate-x-1/2 whitespace-nowrap rounded-lg border border-purple-300/25 bg-[#0a0514] px-3 py-1.5 text-xs font-medium text-purple-100 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
                    role="tooltip"
                  >
                    Sold out in {color}
                  </span>
                ) : (
                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden max-w-[14rem] -translate-x-1/2 whitespace-nowrap rounded-lg border border-purple-300/25 bg-[#0a0514] px-3 py-1.5 text-xs font-medium capitalize text-purple-100 opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block">
                    {color}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedColor && totalColorStock > 0 && totalColorStock <= 5 && (
          <p className="mt-3 text-sm font-bold text-yellow-300">
            Only {totalColorStock} left in {selectedColor}.
          </p>
        )}

        {selectedColor && totalColorStock <= 0 && (
          <p className="mt-3 text-sm font-bold text-red-300">
            This color is currently out of stock.
          </p>
        )}
      </div>

      <div className="mt-6" role="group" aria-labelledby="add-to-cart-size-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="add-to-cart-size-heading" className="font-semibold text-white">
              Choose Size
            </h2>
            <InfoPopover label="Size guide">{HELP.sizeGuide}</InfoPopover>
          </div>

          {selectedVariant && (
            <p
              className={`text-sm font-semibold ${
                selectedVariant.stock_quantity <= 0
                  ? 'text-red-300'
                  : selectedVariant.stock_quantity <= 5
                    ? 'text-yellow-300'
                    : 'text-green-300'
              }`}
            >
              {selectedVariant.stock_quantity <= 0
                ? 'Out of stock'
                : selectedVariant.stock_quantity <= 5
                  ? `Only ${selectedVariant.stock_quantity} left`
                  : 'In stock'}
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-3">
          {sizes.map((size) => {
            const variant = availableVariantsForColor.find(
              (v) => v.size.trim().toUpperCase() === size,
            );

            const inStock = !!variant && variant.stock_quantity > 0;

            return (
              <button
                key={size}
                type="button"
                disabled={!inStock}
                aria-label={
                  !inStock
                    ? `Size ${size}, unavailable for ${selectedColor || 'this color'}`
                    : `Select size ${size}`
                }
                aria-pressed={selectedSize === size}
                onClick={() => {
                  setSelectedSize(size);
                  setMessage('');
                  setSuccess(false);
                }}
                className={`pointer-events-auto min-h-14 touch-manipulation rounded-xl border px-3 py-3.5 text-base font-bold transition sm:px-6 ${
                  selectedSize === size
                    ? 'border-purple-300 bg-purple-300 text-black shadow-[0_0_25px_rgba(168,85,247,0.45)]'
                    : inStock
                      ? 'border-purple-950 bg-[#05070d] text-purple-100 hover:border-purple-300 sm:hover:-translate-y-1'
                      : 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600'
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={addToCart}
        disabled={!selectedColor || !selectedSize || !selectedVariantInStock}
        title={
          !selectedColor
            ? 'Choose a color first'
            : !selectedSize
              ? 'Choose a size first'
              : !selectedVariantInStock
                ? 'This combination is out of stock'
                : 'Add this item to your cart'
        }
        className="pointer-events-auto mt-8 min-h-14 w-full touch-manipulation rounded-full border border-purple-300 bg-purple-300 px-6 py-4 font-black text-black transition hover:bg-white hover:shadow-[0_0_45px_rgba(168,85,247,0.7)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-purple-300 disabled:hover:shadow-none sm:hover:-translate-y-1"
      >
        {!selectedColor
          ? 'Choose Color'
          : !selectedSize
            ? 'Choose Size'
            : !selectedVariantInStock
              ? 'Out of Stock'
              : 'Add to Cart'}
      </button>

      <LiveRegion message={message} politeness={success ? 'polite' : 'assertive'} />

      {message && (
        <div
          role="status"
          className={`mt-5 rounded-3xl border p-4 shadow-[0_18px_50px_rgba(34,197,94,0.18)] ${
            success
              ? 'border-green-300/60 bg-green-500/10 text-green-200'
              : 'border-purple-300/70 bg-purple-300/10 text-purple-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-black ${
                success ? 'bg-green-300 text-black' : 'bg-purple-300 text-black'
              }`}
            >
              {success ? '✓' : '!'}
            </span>

            <div className="flex-1">
              <p className="font-black">{message}</p>

              {success ? (
                <>
                  <div className="mt-4 flex gap-3 rounded-2xl border border-green-300/30 bg-[#05070d] p-3">
                    {selectedImage ? (
                      <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                        <ProductImage
                          src={selectedImage}
                          alt={productImageAlt(null, product.name)}
                          variant="inline"
                        />
                      </span>
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#111827] text-xs text-gray-400">
                        No image
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 font-bold text-white">
                        {product.name}
                      </p>

                      <p className="mt-1 text-sm capitalize text-green-100/80">
                        {selectedColor} / {selectedSize}
                      </p>

                      <p className="mt-1 text-sm font-bold text-green-300">
                        EGP {Number(product.sale_price || product.base_price).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/cart"
                      className="rounded-full border border-green-300 bg-green-300 px-5 py-3 text-center font-black text-black transition hover:bg-white"
                    >
                      Proceed to Cart!
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setMessage('');
                        setSuccess(false);
                      }}
                      className="rounded-full border border-purple-300/40 bg-purple-500/10 px-5 py-3 font-bold text-purple-100 transition hover:bg-purple-300 hover:text-black"
                    >
                      Keep Shopping
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-sm text-purple-100/80">
                  Please check your selection and try again.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}