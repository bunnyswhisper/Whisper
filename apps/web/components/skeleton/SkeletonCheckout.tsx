import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

export function SkeletonCheckout() {
  return (
    <div
      className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8"
      aria-busy="true"
      aria-label="Loading checkout"
    >
      <div className="space-y-6">
        <SkeletonBase className="p-5 sm:p-6">
          <SkeletonBase block className="h-7 w-48 rounded-xl" />
          <SkeletonText lines={4} className="mt-5" />
        </SkeletonBase>
        <SkeletonBase className="p-5 sm:p-6">
          <SkeletonBase block className="h-7 w-40 rounded-xl" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonBase key={i} block className="h-12 rounded-xl" />
            ))}
          </div>
        </SkeletonBase>
        <SkeletonBase className="p-5 sm:p-6">
          <SkeletonBase block className="h-7 w-36 rounded-xl" />
          <SkeletonText lines={3} className="mt-5" />
          <SkeletonBase block className="mt-6 h-14 w-full rounded-full" />
        </SkeletonBase>
      </div>

      <SkeletonBase className="h-fit p-5 sm:p-6 lg:sticky lg:top-10">
        <SkeletonBase block className="h-6 w-32 rounded-xl" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex gap-3">
              <SkeletonBase block className="h-16 w-14 shrink-0 rounded-xl" />
              <SkeletonText lines={2} className="flex-1" />
            </div>
          ))}
        </div>
        <SkeletonBase block className="mt-6 h-12 w-full rounded-full" />
      </SkeletonBase>
    </div>
  );
}
