import type { ReactNode } from 'react';
import Navbar from '@/components/Navbar';

/** Shared chrome for policy pages so Navbar persists across legal route changes. */
export default function LegalRoutesLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8">
      <Navbar />
      {children}
    </main>
  );
}
