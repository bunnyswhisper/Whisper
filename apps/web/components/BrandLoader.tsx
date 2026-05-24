'use client';

import { createPortal } from 'react-dom';
import { useSyncExternalStore } from 'react';

export type BrandLoaderVariant = 'overlay' | 'fullscreen' | 'embedded';

export type BrandLoaderProps = {
  message?: string;
  variant?: BrandLoaderVariant;
  className?: string;
};

const emptySubscribe = () => () => {};

/**
 * Bunny's Whisper branded loader — floating logo, purple glow, dark backdrop.
 * Uses a normal <img> (no Next/Image priority) to avoid logo preload warnings.
 *
 * Overlay/fullscreen render into `document.body` on the client so they always sit above
 * the global footer and layout stacking contexts (SSR/hydration uses inline markup first).
 */
export default function BrandLoader({
  message = 'LOADING...',
  variant = 'embedded',
  className = '',
}: BrandLoaderProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const content = (
    <div className="bunny-float flex flex-col items-center">
      <img
        src="/logo.png"
        alt="Bunny's Whisper"
        width={112}
        height={112}
        decoding="async"
        className="h-28 w-28 object-contain drop-shadow-[0_0_35px_rgba(168,85,247,0.45)]"
      />
      <p className="mt-6 text-center text-xl font-semibold tracking-[0.2em] text-purple-200">
        {message}
      </p>
    </div>
  );

  const modalChrome =
    variant === 'overlay' || variant === 'fullscreen' ? (
      <div
        data-overlay={variant === 'overlay' ? 'next-loading' : undefined}
        className={`fixed inset-0 z-[2147483000] flex items-center justify-center overflow-hidden bg-[#05070d] text-white ${className}`}
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label={message}
      >
        {content}
      </div>
    ) : null;

  if (variant === 'overlay' || variant === 'fullscreen') {
    if (typeof document !== 'undefined' && isClient) {
      return createPortal(modalChrome, document.body);
    }
    return modalChrome;
  }

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 ${className}`}
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label={message}
    >
      {content}
    </div>
  );
}
