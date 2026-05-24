'use client';

import type { ReactNode } from 'react';
import { useMounted } from '@/components/reviews/useMounted';

type MountedOnlyProps = {
  children: ReactNode;
  /** Shown during SSR and until client mount (keep layout stable). */
  fallback?: ReactNode;
};

/**
 * Renders children only after client mount.
 * Use for review forms/filters where browser extensions may inject attributes
 * (e.g. fdprocessedid) before React hydrates.
 */
export function MountedOnly({ children, fallback = null }: MountedOnlyProps) {
  const mounted = useMounted();
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
