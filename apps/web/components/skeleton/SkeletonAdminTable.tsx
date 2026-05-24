import { SkeletonBase } from './SkeletonBase';

type SkeletonAdminTableProps = {
  rows?: number;
  cols?: number;
};

export function SkeletonAdminTable({ rows = 6, cols = 5 }: SkeletonAdminTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-purple-950 md:block" aria-busy="true">
      <div className="grid gap-px bg-purple-950/80" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBase key={`h-${i}`} block className="h-10 rounded-none" />
        ))}
        {Array.from({ length: rows * cols }, (_, i) => (
          <SkeletonBase key={i} block className="h-12 rounded-none" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonAdminTableMobile({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 md:hidden" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBase key={i} className="p-4">
          <SkeletonBase block className="h-5 w-2/3 rounded-lg" />
          <SkeletonBase block className="mt-3 h-4 w-full rounded-md" />
          <SkeletonBase block className="mt-2 h-4 w-4/5 rounded-md" />
        </SkeletonBase>
      ))}
    </div>
  );
}

export function SkeletonAdminInventoryPage() {
  return (
    <div className="mt-8 space-y-6" aria-busy="true" aria-label="Loading inventory">
      <div className="flex flex-wrap gap-3">
        <SkeletonBase block className="h-11 w-40 rounded-full" />
        <SkeletonBase block className="h-11 w-32 rounded-full" />
      </div>
      <SkeletonAdminTable />
      <SkeletonAdminTableMobile />
    </div>
  );
}
