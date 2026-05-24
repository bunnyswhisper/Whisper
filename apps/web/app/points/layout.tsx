import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Bunny Points');

export default function PointsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
