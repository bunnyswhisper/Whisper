import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Sign in');

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
