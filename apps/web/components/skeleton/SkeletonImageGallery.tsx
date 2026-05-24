import { SkeletonBase } from './SkeletonBase';

type SkeletonImageGalleryProps = {
  className?: string;
  thumbCount?: number;
};

/** Matches ProductGallery: hero image + thumbnail strip. */
export function SkeletonImageGallery({
  className = '',
  thumbCount = 4,
}: SkeletonImageGalleryProps) {
  return (
    <div
      className={`min-w-0 ${className}`}
      aria-busy="true"
      aria-label="Loading gallery"
    >
      <SkeletonBase className="overflow-hidden rounded-3xl p-0">
        <SkeletonBase
          block
          className="min-h-[22rem] w-full rounded-none sm:min-h-[560px] lg:min-h-[600px]"
        />
      </SkeletonBase>

      <div className="mt-4 flex snap-x gap-3 overflow-hidden sm:grid sm:grid-cols-4">
        {Array.from({ length: thumbCount }, (_, i) => (
          <SkeletonBase
            key={i}
            block
            className="h-[3.25rem] min-w-[3.25rem] shrink-0 rounded-xl sm:h-20 sm:w-full"
          />
        ))}
      </div>
    </div>
  );
}
