import type { Metadata } from 'next';

/** Private / transactional routes — not for search indexing. */
export const NOINDEX_ROBOTS: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export function noIndexMetadata(title?: string): Metadata {
  return {
    ...(title ? { title } : {}),
    robots: NOINDEX_ROBOTS,
  };
}
