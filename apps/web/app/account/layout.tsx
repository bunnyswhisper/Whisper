import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Account');

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
