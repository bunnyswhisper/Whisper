import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

export function SkeletonOrderCard() {
  return (
    <SkeletonBase className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <SkeletonBase block className="h-6 w-40 max-w-full rounded-xl" />
          <SkeletonText lines={2} lastLineWidth={0.55} />
        </div>
        <SkeletonBase block className="h-9 w-28 shrink-0 rounded-full" />
      </div>
      <div className="mt-5 flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonBase key={i} block className="h-16 w-16 shrink-0 rounded-xl" />
        ))}
      </div>
    </SkeletonBase>
  );
}

export function SkeletonOrderList({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading orders">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bw-skeleton-stagger" style={{ animationDelay: `${i * 60}ms` }}>
          <SkeletonOrderCard />
        </div>
      ))}
    </div>
  );
}
