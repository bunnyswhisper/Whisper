import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Admin');

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
