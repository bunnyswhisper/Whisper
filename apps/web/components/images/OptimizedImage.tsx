'use client';

import Image, { type ImageProps } from 'next/image';
import { BW_IMAGE_BLUR_DATA_URL } from '@/lib/images/imageConstants';
import { canOptimizeWithNextImage } from '@/lib/images/canOptimizeWithNextImage';

export type OptimizedImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  quality?: number;
  fill?: boolean;
  width?: number;
  height?: number;
  noPlaceholder?: boolean;
  draggable?: boolean;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
};

export function OptimizedImage({
  src,
  alt,
  className = '',
  sizes,
  priority = false,
  quality = 75,
  fill = false,
  width,
  height,
  noPlaceholder = false,
  draggable = false,
  onClick,
}: OptimizedImageProps) {
  if (!canOptimizeWithNextImage(src)) {
    return (
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        onClick={onClick}
        className={className}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }

  const shared: Pick<ImageProps, 'src' | 'alt' | 'quality' | 'priority' | 'sizes' | 'placeholder' | 'blurDataURL'> = {
    src,
    alt,
    quality,
    priority,
    sizes,
    ...(noPlaceholder
      ? { placeholder: 'empty' as const }
      : { placeholder: 'blur' as const, blurDataURL: BW_IMAGE_BLUR_DATA_URL }),
  };

  if (fill) {
    return (
      <Image
        {...shared}
        fill
        className={className}
        draggable={draggable}
        onClick={onClick}
        style={{ objectFit: 'cover' }}
      />
    );
  }

  const w = width ?? 640;
  const h = height ?? 800;

  return (
    <Image
      {...shared}
      width={w}
      height={h}
      className={className}
      draggable={draggable}
      onClick={onClick}
    />
  );
}
