import { SkeletonBase } from './SkeletonBase';
import { SkeletonImageGallery } from './SkeletonImageGallery';
import { SkeletonText } from './SkeletonText';

export function SkeletonProductDetail() {
  return (
    <div
      className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.95fr] lg:gap-12"
      aria-busy="true"
      aria-label="Loading product"
    >
      <SkeletonImageGallery />

      <SkeletonBase className="min-h-[32rem] p-5 sm:p-6 lg:sticky lg:top-10 lg:p-8">
        <SkeletonBase block className="h-10 w-full max-w-md rounded-xl" />
        <div className="mt-4 flex flex-wrap gap-2">
          <SkeletonBase block className="h-9 w-24 rounded-full" />
          <SkeletonBase block className="h-9 w-28 rounded-full" />
        </div>
        <SkeletonBase block className="mt-6 h-10 w-40 rounded-xl" />
        <SkeletonText lines={5} className="mt-6" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBase key={i} block className="h-4 w-full rounded-md" />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBase key={i} block className="h-14 w-14 rounded-xl" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBase key={i} block className="h-14 min-w-[4.5rem] flex-1 rounded-xl sm:w-20" />
          ))}
        </div>
        <SkeletonBase block className="mt-8 h-14 w-full rounded-full" />
      </SkeletonBase>
    </div>
  );
}
