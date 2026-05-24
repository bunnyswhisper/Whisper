'use client';

import type { ReactNode } from 'react';

type SkeletonRevealProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Fade-in wrapper for content after skeleton → loaded transition.
 * Parent should swap skeleton out before mounting this.
 */
export function SkeletonReveal({ children, className = '' }: SkeletonRevealProps) {
  return <div className={`bw-content-reveal ${className}`}>{children}</div>;
}

type AsyncViewProps = {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Shows skeleton while loading, then reveals children with a soft fade. */
export function AsyncView({
  loading,
  skeleton,
  children,
  className = '',
}: AsyncViewProps) {
  if (loading) {
    return <>{skeleton}</>;
  }

  return <SkeletonReveal className={className}>{children}</SkeletonReveal>;
}
