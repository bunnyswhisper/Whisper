import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Payment');

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
