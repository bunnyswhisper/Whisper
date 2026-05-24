'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Minimal client boundary test for LAN/mobile: if this counter works but inline
 * handlers on the page do not, the issue is likely page composition or hydration.
 */
export default function TapTestClient() {
  const [count, setCount] = useState(0);
  const nativeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = nativeRef.current;
    if (!el) return;

    const onNativeClick = () => {
      setCount((c) => c + 1000);
    };

    el.addEventListener('click', onNativeClick);
    return () => el.removeEventListener('click', onNativeClick);
  }, []);

  return (
    <section className="space-y-3 rounded-xl border border-amber-500/50 bg-[#0a0612] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
        Isolated client component (TapTestClient.tsx)
      </p>
      <button
        type="button"
        className="min-h-12 w-full rounded-lg bg-amber-400 px-4 py-3 font-bold text-black touch-manipulation"
        onClick={() => setCount((c) => c + 1)}
      >
        React onClick only — count: {count}
      </button>
      <button
        ref={nativeRef}
        type="button"
        className="min-h-12 w-full rounded-lg border border-amber-400/60 bg-transparent px-4 py-3 font-bold text-amber-200 touch-manipulation"
      >
        Native addEventListener only — adds +1000 (no React onClick)
      </button>
      <p className="text-[11px] text-gray-400">
        If the amber button increments by 1, React handlers work. If only the
        native button jumps by 1000, expect blocked dev bundles / failed hydration
        (check Next cross-origin dev allowlist for your LAN IP).
      </p>
    </section>
  );
}
