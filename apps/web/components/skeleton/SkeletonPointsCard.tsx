import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

export function SkeletonPointsCard() {
  return (
    <SkeletonBase className="p-4 sm:p-6">
      <SkeletonBase block className="h-4 w-36 rounded-lg" />
      <SkeletonBase block className="mt-4 h-12 w-40 rounded-xl" />
      <SkeletonText lines={2} className="mt-4" lastLineWidth={0.5} />
      <SkeletonBase block className="mt-8 h-4 w-full rounded-full" />
      <div className="mt-6 grid grid-cols-5 gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonBase key={i} block className="mx-auto h-10 w-10 rounded-full sm:h-12 sm:w-12" />
        ))}
      </div>
    </SkeletonBase>
  );
}

export function SkeletonPointsPage() {
  return (
    <div className="mt-8 space-y-8" aria-busy="true" aria-label="Loading Bunny Points">
      <SkeletonPointsCard />
      <SkeletonBase className="p-4 sm:p-6">
        <SkeletonBase block className="h-7 w-40 rounded-xl" />
        <SkeletonText lines={2} className="mt-4" />
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <SkeletonBase block className="h-14 flex-1 rounded-xl" />
          <SkeletonBase block className="h-14 w-full rounded-full sm:w-36" />
        </div>
      </SkeletonBase>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonBase key={i} className="p-5">
            <SkeletonBase block className="h-9 w-24 rounded-xl" />
            <SkeletonText lines={2} className="mt-4" />
            <SkeletonBase block className="mt-5 h-12 w-full rounded-full" />
          </SkeletonBase>
        ))}
      </div>
    </div>
  );
}
