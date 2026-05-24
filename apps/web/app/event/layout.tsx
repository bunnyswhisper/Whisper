import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Event');

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return children;
}
