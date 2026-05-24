'use client';

type LiveRegionProps = {
  message: string;
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
  className?: string;
};

/** Announces dynamic updates to screen readers without moving focus. */
export function LiveRegion({
  message,
  politeness = 'polite',
  atomic = true,
  className = 'sr-only',
}: LiveRegionProps) {
  if (!message) return null;

  return (
    <div role="status" aria-live={politeness} aria-atomic={atomic} className={className}>
      {message}
    </div>
  );
}
