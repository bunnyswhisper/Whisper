import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Sign out');

export default function LogoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
