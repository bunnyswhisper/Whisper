import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

export function SkeletonAccountForm() {
  return (
    <div className="mx-auto max-w-xl space-y-6" aria-busy="true" aria-label="Loading profile">
      <SkeletonBase className="p-5 sm:p-6">
        <SkeletonBase block className="h-7 w-44 rounded-xl" />
        <SkeletonText lines={2} className="mt-4" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBase key={i} block className="h-12 w-full rounded-xl" />
          ))}
        </div>
        <SkeletonBase block className="mt-6 h-12 w-full rounded-full" />
      </SkeletonBase>
    </div>
  );
}
