import { SkeletonBase } from './SkeletonBase';

type SkeletonTextProps = {
  lines?: number;
  className?: string;
  lastLineWidth?: number;
};

export function SkeletonText({
  lines = 3,
  className = '',
  lastLineWidth = 0.65,
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBase
          key={i}
          block
          className="h-3.5 rounded-md"
          style={{
            width: i === lines - 1 ? `${Math.round(lastLineWidth * 100)}%` : '100%',
          }}
        />
      ))}
    </div>
  );
}
