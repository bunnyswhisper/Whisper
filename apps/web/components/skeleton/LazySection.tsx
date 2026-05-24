'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type LazySectionProps = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Reserve space to limit CLS before mount */
  minHeight?: string | number;
  rootMargin?: string;
  className?: string;
};

/**
 * Defers rendering children until the section nears the viewport.
 * Use for below-the-fold charts, galleries, or heavy admin blocks.
 */
export function LazySection({
  children,
  fallback = null,
  minHeight,
  rootMargin = '180px 0px',
  className = '',
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  const style =
    minHeight !== undefined
      ? { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }
      : undefined;

  return (
    <div ref={ref} className={className} style={style}>
      {visible ? (
        <div className="bw-content-reveal">{children}</div>
      ) : (
        fallback
      )}
    </div>
  );
}
