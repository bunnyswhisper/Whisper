import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

export function SkeletonAnalyticsCard() {
  return (
    <SkeletonBase className="p-4 sm:p-6">
      <SkeletonBase block className="h-4 w-28 rounded-lg" />
      <SkeletonBase block className="mt-4 h-10 w-36 rounded-xl" />
      <SkeletonText lines={2} className="mt-3" lastLineWidth={0.45} />
    </SkeletonBase>
  );
}

export function SkeletonAnalyticsDashboard() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonAnalyticsCard key={i} />
        ))}
      </div>
      <SkeletonBase className="h-72 p-4 sm:h-80">
        <SkeletonText lines={1} className="max-w-xs" />
        <SkeletonBase block className="mt-6 h-full min-h-[12rem] w-full rounded-2xl" />
      </SkeletonBase>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonBase className="h-64 p-4" />
        <SkeletonBase className="h-64 p-4" />
      </div>
    </div>
  );
}
