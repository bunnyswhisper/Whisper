import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Cart');

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
