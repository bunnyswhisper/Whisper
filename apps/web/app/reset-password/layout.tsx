import type { Metadata } from 'next';
import { noIndexMetadata } from '@/lib/seo/noindex';

export const metadata: Metadata = noIndexMetadata('Reset password');

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
