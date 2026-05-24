import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Debug');

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
