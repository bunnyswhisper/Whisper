import { SkeletonCard } from './SkeletonCard';

type SkeletonProductGridProps = {
  count?: number;
  className?: string;
};

export function SkeletonProductGrid({
  count = 6,
  className = '',
}: SkeletonProductGridProps) {
  return (
    <div
      className={`grid items-stretch gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8 ${className}`}
      aria-busy="true"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
