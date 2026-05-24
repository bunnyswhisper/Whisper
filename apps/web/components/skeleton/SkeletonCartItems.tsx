import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

function SkeletonCartLine() {
  return (
    <SkeletonBase className="flex gap-4 p-4 sm:p-5">
      <SkeletonBase block className="h-24 w-20 shrink-0 rounded-2xl sm:h-28 sm:w-24" />
      <div className="min-w-0 flex-1 space-y-3">
        <SkeletonBase block className="h-5 w-3/4 max-w-xs rounded-lg" />
        <SkeletonText lines={2} lastLineWidth={0.5} />
        <div className="flex gap-2">
          <SkeletonBase block className="h-10 w-28 rounded-full" />
          <SkeletonBase block className="h-10 w-28 rounded-full" />
        </div>
      </div>
    </SkeletonBase>
  );
}

export function SkeletonCartItems({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading cart items">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCartLine key={i} />
      ))}
    </div>
  );
}

export function SkeletonCartSummary() {
  return (
    <SkeletonBase className="p-5 sm:p-6">
      <SkeletonBase block className="h-6 w-32 rounded-xl" />
      <SkeletonText lines={4} className="mt-5" />
      <SkeletonBase block className="mt-6 h-14 w-full rounded-full" />
    </SkeletonBase>
  );
}

export function SkeletonCartPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_360px]" aria-busy="true">
      <SkeletonCartItems />
      <SkeletonCartSummary />
    </div>
  );
}
