'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

type InternalNavLinkProps = ComponentProps<typeof Link>;

/**
 * Client-mounted Next.js link for in-app routes.
 * Ensures footer/policy taps use the App Router (not a full document load when hydrated).
 */
export function InternalNavLink({
  prefetch = true,
  ...props
}: InternalNavLinkProps) {
  return <Link prefetch={prefetch} {...props} />;
}
