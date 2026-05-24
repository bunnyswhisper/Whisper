import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Checkout');

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
