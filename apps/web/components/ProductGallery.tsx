'use client';

import { useEffect, useId, useState } from 'react';
import { ProductImage } from '@/components/images';
import { useDialog } from '@/lib/a11y/useDialog';
import { productImageAlt } from '@/lib/a11y/productImageAlt';

type ProductImage = {
  image_url: string;
  alt_text: string | null;
};

export function ProductGallery({
  images,
  productName,
  activeImageFromVariant,
  noImagesForColor,
  selectedColorName,
}: {
  images: ProductImage[];
  productName: string;
  activeImageFromVariant?: string;
  /** When true, show a premium placeholder instead of wrong-color or card images. */
  noImagesForColor?: boolean;
  selectedColorName?: string;
}) {
  const [activeImage, setActiveImage] = useState(images?.[0]?.image_url || '');
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenTitleId = useId();
  const { dialogProps } = useDialog({
    open: fullscreen,
    onClose: () => setFullscreen(false),
    labelId: fullscreenTitleId,
  });

  const activeIndex = images.findIndex((img) => img.image_url === activeImage);
  const activeMeta = images[activeIndex >= 0 ? activeIndex : 0];
  const mainAlt = productImageAlt(activeMeta?.alt_text, productName, {
    index: activeIndex >= 0 ? activeIndex : 0,
    view: 'main',
  });

  const showColorPlaceholder =
    Boolean(noImagesForColor) ||
    (images.length === 0 && Boolean(selectedColorName?.trim()));

  useEffect(() => {
    if (showColorPlaceholder) {
      setActiveImage('');
      return;
    }
    if (!images.length) {
      setActiveImage('');
      return;
    }
    const preferred = activeImageFromVariant || images[0]?.image_url || '';
    const urls = new Set(images.map((img) => img.image_url));
    setActiveImage(urls.has(preferred) ? preferred : images[0]?.image_url || '');
  }, [images, activeImageFromVariant, showColorPlaceholder]);

  return (
    <div className="min-w-0">
      <div className="group relative overflow-hidden rounded-3xl border border-purple-950 bg-[#0d0716] shadow-[0_18px_50px_rgba(168,85,247,0.18)]">
        {!showColorPlaceholder && activeImage ? (
          <>
            <div className="relative aspect-[4/5] min-h-[22rem] w-full sm:aspect-auto sm:min-h-0 sm:h-[560px] lg:h-[600px]">
              <ProductImage
                src={activeImage}
                alt={mainAlt}
                variant="galleryHero"
                priority
                className="pointer-events-none select-none"
              />
            </div>

            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="pointer-events-auto absolute inset-0 z-10 flex cursor-pointer touch-manipulation items-center justify-center bg-black/0 opacity-100 transition [-webkit-tap-highlight-color:transparent] sm:opacity-0 sm:group-hover:bg-black/30 sm:group-hover:opacity-100"
              aria-label={`View ${productName} image fullscreen`}
            >
              <span
                className="absolute bottom-4 right-4 rounded-full border border-purple-300 bg-[#0b0612]/80 px-4 py-3 text-xl text-purple-100 shadow-[0_0_35px_rgba(168,85,247,0.7)] backdrop-blur sm:static sm:px-6 sm:py-4 sm:text-3xl"
                aria-hidden
              >
                ⛶
              </span>
            </button>
          </>
        ) : showColorPlaceholder ? (
          <GalleryColorPlaceholder selectedColorName={selectedColorName} />
        ) : (
          <div
            className="flex aspect-[4/5] min-h-[22rem] items-center justify-center text-gray-300 sm:aspect-auto sm:min-h-0 sm:h-[560px] lg:h-[600px]"
            role="img"
            aria-label={`No image available for ${productName}`}
          >
            No image
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div
          className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label={`${productName} gallery thumbnails`}
        >
          {images.map((image, index) => {
            const thumbAlt = productImageAlt(image.alt_text, productName, {
              index,
              view: 'thumbnail',
            });
            const selected = activeImage === image.image_url;

            return (
              <button
                type="button"
                key={image.image_url}
                onClick={() => setActiveImage(image.image_url)}
                aria-label={`Show ${thumbAlt}`}
                aria-current={selected ? 'true' : undefined}
                className={`pointer-events-auto relative min-h-[3.25rem] min-w-[3.25rem] shrink-0 cursor-pointer touch-manipulation overflow-hidden rounded-xl border bg-[#0d0716] transition hover:shadow-[0_0_30px_rgba(168,85,247,0.45)] sm:h-24 sm:w-full sm:hover:-translate-y-1 ${
                  selected
                    ? 'border-purple-300 shadow-[0_0_30px_rgba(168,85,247,0.45)]'
                    : 'border-purple-950'
                }`}
              >
                <span className="relative block h-20 w-20 sm:h-24 sm:w-full">
                  <ProductImage
                    src={image.image_url}
                    alt=""
                    variant="galleryThumb"
                  />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {fullscreen && activeImage ? (
        <div className="pointer-events-auto fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-md sm:p-6">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close fullscreen image"
            onClick={() => setFullscreen(false)}
          />
          <div
            {...dialogProps}
            className="relative z-10 flex max-h-full max-w-full flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p id={fullscreenTitleId} className="sr-only">
              {mainAlt}
            </p>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="pointer-events-auto absolute right-[max(0.5rem,env(safe-area-inset-right))] top-[max(0.5rem,env(safe-area-inset-top))] z-20 flex h-12 min-h-12 min-w-12 w-12 cursor-pointer touch-manipulation items-center justify-center rounded-full border border-purple-300 bg-[#12091f] text-3xl font-bold text-purple-100 shadow-[0_0_35px_rgba(168,85,247,0.7)] transition hover:bg-purple-300 hover:text-black sm:right-0 sm:top-0 sm:h-14 sm:w-14"
              aria-label="Close fullscreen image"
            >
              <span aria-hidden>×</span>
            </button>

            <ProductImage
              src={activeImage}
              alt={mainAlt}
              variant="galleryFullscreen"
              className="pointer-events-auto touch-manipulation shadow-[0_0_70px_rgba(168,85,247,0.45)]"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GalleryColorPlaceholder({
  selectedColorName,
}: {
  selectedColorName?: string;
}) {
  const colorLabel = selectedColorName?.trim();

  return (
    <div
      className="relative flex aspect-[4/5] min-h-[22rem] flex-col items-center justify-center gap-5 overflow-hidden px-6 text-center sm:aspect-auto sm:min-h-0 sm:h-[560px] lg:h-[600px]"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(168,85,247,0.22)_0%,transparent_62%)]"
        aria-hidden
      />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-purple-300/25 bg-[#12091f]/90 shadow-[0_0_45px_rgba(168,85,247,0.35)]">
        <img
          src="/logo.png"
          alt=""
          className="h-12 w-12 object-contain opacity-55"
          aria-hidden
        />
      </div>
      <div className="relative max-w-sm space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-purple-300">
          {colorLabel ? `${colorLabel} gallery` : 'Color gallery'}
        </p>
        <p className="text-lg font-semibold text-white">
          Images for this color are coming soon.
        </p>
        <p className="text-sm leading-relaxed text-gray-400">
          Select another color to preview available photos.
        </p>
      </div>
    </div>
  );
}
