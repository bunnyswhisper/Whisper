import type { Metadata } from 'next';
import { indexablePageMetadata } from '@/lib/seo/siteConfig';

export function buildLegalPageMetadata(
  path: string,
  title: string,
  description: string,
): Metadata {
  return indexablePageMetadata(path, title, description);
}
