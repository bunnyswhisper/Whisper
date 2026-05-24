'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import CartScopeSync from '@/components/CartScopeSync';
import { PwaInstallBanner } from '@/components/pwa/PwaInstallBanner';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <CartScopeSync />
      {children}
      <PwaInstallBanner />
    </QueryClientProvider>
  );
}
