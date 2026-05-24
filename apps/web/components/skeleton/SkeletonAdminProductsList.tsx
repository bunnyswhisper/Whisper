import { SkeletonBase } from './SkeletonBase';

function SkeletonAdminProductRow() {
  return (
    <SkeletonBase className="p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <SkeletonBase block className="h-16 w-16 shrink-0 rounded-2xl" />
          <div className="min-w-0 space-y-2">
            <SkeletonBase block className="h-6 w-48 max-w-full rounded-xl" />
            <SkeletonBase block className="h-4 w-32 rounded-lg" />
            <SkeletonBase block className="h-4 w-40 rounded-lg" />
          </div>
        </div>
        <SkeletonBase block className="h-10 w-28 shrink-0 rounded-full" />
      </div>
    </SkeletonBase>
  );
}

export function SkeletonAdminProductsList({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bw-skeleton-stagger" style={{ animationDelay: `${i * 60}ms` }}>
          <SkeletonAdminProductRow />
        </div>
      ))}
    </div>
  );
}
