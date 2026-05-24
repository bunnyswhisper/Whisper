/** Tiny purple shimmer used as Next/Image blur placeholder (SVG → data URL). */
export const BW_IMAGE_BLUR_DATA_URL =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#07030d"/><stop offset="50%" stop-color="#2e1065"/><stop offset="100%" stop-color="#07030d"/></linearGradient></defs><rect width="8" height="10" fill="url(#g)"/></svg>',
  );

/** Responsive `sizes` hints for common layouts */
export const IMAGE_SIZE_HINTS = {
  catalogCard: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  galleryHero: '(max-width: 1024px) 100vw, min(600px, 50vw)',
  galleryFullscreen: '100vw',
  galleryThumb: '96px',
  cartLine: '112px',
  cartUpsell: '96px',
  checkoutLine: '80px',
  adminThumb: '160px',
  addToCartSuccess: '64px',
} as const;

/** Default intrinsic dimensions when using fixed width/height mode */
export const IMAGE_DIMENSIONS = {
  catalog: { width: 640, height: 800 },
  galleryHero: { width: 1200, height: 1500 },
  galleryThumb: { width: 192, height: 192 },
  cartThumb: { width: 224, height: 224 },
  adminThumb: { width: 320, height: 320 },
} as const;
