'use client';

import { useEffect, useState } from 'react';
import SocialQrFooter from '@/components/SocialQrFooter';

/** Footer waits for client mount so it never flashes above loaders during SSR/hydration. */
export default function DeferredSocialFooter() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <SocialQrFooter />;
}
