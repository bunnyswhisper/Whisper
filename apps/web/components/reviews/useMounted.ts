'use client';

import { useEffect, useState } from 'react';

/** True after the component has mounted on the client (avoids SSR/extension attribute mismatches on form controls). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
