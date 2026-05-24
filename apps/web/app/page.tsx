import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import ProductCatalog from '@/components/home/ProductCatalog';
import { indexablePageMetadata } from '@/lib/seo/siteConfig';

export const metadata: Metadata = {
  ...indexablePageMetadata(
    '/',
    'Luxury Dark Streetwear Collection',
    "Shop Bunny's Whisper SS25 — limited luxury dark streetwear crafted in Egypt. Discover the collection online.",
  ),
};

export default function Home() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <section className="mx-auto max-w-6xl">
        <Navbar />

        <div className="mb-10 px-1 text-center sm:mb-12">
          <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.35em]">
            Unrevealed Summer Collection
          </p>

          <h1 className="mx-auto mt-4 max-w-4xl bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-4xl font-black tracking-[0.08em] text-transparent drop-shadow-[0_0_25px_rgba(168,85,247,0.35)] sm:text-5xl sm:tracking-[0.12em] md:text-7xl">
            BUNNY&apos;S WHISPER
          </h1>

          <p className="mx-auto mt-4 max-w-2xl font-serif text-xl italic tracking-[0.16em] text-purple-200 drop-shadow-[0_0_18px_rgba(168,85,247,0.45)] sm:mt-5 sm:text-2xl sm:tracking-[0.2em]">
            shhh...
          </p>
        </div>

        <ProductCatalog />
      </section>
    </main>
  );
}
