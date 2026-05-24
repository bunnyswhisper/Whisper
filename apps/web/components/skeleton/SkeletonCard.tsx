import { SkeletonBase } from './SkeletonBase';
import { SkeletonText } from './SkeletonText';

type SkeletonCardProps = {
  className?: string;
  imageClassName?: string;
  lines?: number;
};

export function SkeletonCard({
  className = '',
  imageClassName = 'h-72 sm:h-80',
  lines = 3,
}: SkeletonCardProps) {
  return (
    <SkeletonBase className={`flex h-full flex-col p-0 ${className}`}>
      <SkeletonBase block className={`w-full rounded-none ${imageClassName}`} />
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
        <SkeletonBase block className="h-6 w-3/4 max-w-[14rem] rounded-xl" />
        <SkeletonText lines={lines} lastLineWidth={0.55} />
        <SkeletonBase block className="mt-auto h-12 w-full rounded-full" />
      </div>
    </SkeletonBase>
  );
}
