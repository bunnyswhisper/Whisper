'use client';

import { OptimizedImage } from '@/components/images/OptimizedImage';
import {
  IMAGE_DIMENSIONS,
  IMAGE_SIZE_HINTS,
} from '@/lib/images/imageConstants';

export type ProductImageVariant =
  | 'catalog'
  | 'galleryHero'
  | 'galleryThumb'
  | 'galleryFullscreen'
  | 'cart'
  | 'cartUpsell'
  | 'checkout'
  | 'admin'
  | 'inline';

type ProductImageProps = {
  src: string;
  alt: string;
  variant: ProductImageVariant;
  className?: string;
  priority?: boolean;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
};

const variantConfig: Record<
  ProductImageVariant,
  {
    fill: boolean;
    sizes: string;
    width?: number;
    height?: number;
    quality: number;
    noPlaceholder?: boolean;
    defaultClass: string;
  }
> = {
  catalog: {
    fill: true,
    sizes: IMAGE_SIZE_HINTS.catalogCard,
    quality: 75,
    defaultClass: 'object-cover transition duration-300 group-hover:scale-105',
  },
  galleryHero: {
    fill: true,
    sizes: IMAGE_SIZE_HINTS.galleryHero,
    quality: 75,
    defaultClass: 'object-cover transition duration-500 group-hover:scale-105',
  },
  galleryThumb: {
    fill: true,
    sizes: IMAGE_SIZE_HINTS.galleryThumb,
    quality: 75,
    noPlaceholder: true,
    defaultClass: 'object-cover',
  },
  galleryFullscreen: {
    fill: false,
    sizes: IMAGE_SIZE_HINTS.galleryFullscreen,
    width: 1400,
    height: 1400,
    quality: 75,
    defaultClass:
      'h-auto max-h-[min(88dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem))] w-auto max-w-[min(94vw,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)-2rem))] rounded-3xl object-contain sm:max-h-[90vh] sm:max-w-[92vw]',
  },
  cart: {
    fill: true,
    sizes: IMAGE_SIZE_HINTS.cartLine,
    quality: 75,
    noPlaceholder: true,
    defaultClass: 'object-cover',
  },
  cartUpsell: {
    fill: true,
    sizes: IMAGE_SIZE_HINTS.cartUpsell,
    quality: 75,
    noPlaceholder: true,
    defaultClass: 'object-cover',
  },
  checkout: {
    fill: true,
    sizes: IMAGE_SIZE_HINTS.checkoutLine,
    quality: 75,
    noPlaceholder: true,
    defaultClass: 'object-cover',
  },
  admin: {
    fill: true,
    sizes: IMAGE_SIZE_HINTS.adminThumb,
    quality: 75,
    defaultClass: 'object-cover',
  },
  inline: {
    fill: true,
    sizes: '96px',
    quality: 75,
    noPlaceholder: true,
    defaultClass: 'object-cover',
  },
};

export function ProductImage({
  src,
  alt,
  variant,
  className = '',
  priority = false,
  onClick,
}: ProductImageProps) {
  const cfg = variantConfig[variant];
  const dims =
    variant === 'galleryThumb'
      ? IMAGE_DIMENSIONS.galleryThumb
      : variant === 'cart' || variant === 'cartUpsell'
        ? IMAGE_DIMENSIONS.cartThumb
        : variant === 'admin'
          ? IMAGE_DIMENSIONS.adminThumb
          : IMAGE_DIMENSIONS.catalog;

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      fill={cfg.fill && variant !== 'galleryFullscreen'}
      width={cfg.width ?? (cfg.fill ? undefined : dims.width)}
      height={cfg.height ?? (cfg.fill ? undefined : dims.height)}
      sizes={cfg.sizes}
      quality={cfg.quality}
      priority={priority}
      noPlaceholder={cfg.noPlaceholder}
      className={`${cfg.defaultClass} ${className}`.trim()}
      onClick={onClick}
    />
  );
}
