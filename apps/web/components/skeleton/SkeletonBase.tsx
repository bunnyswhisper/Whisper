import type { CSSProperties, ReactNode } from 'react';

const shimmerBlock =
  'bw-skeleton shadow-[inset_0_0_0_1px_rgba(168,85,247,0.12),0_0_24px_rgba(88,28,135,0.15)]';

const shimmerCard =
  'bw-skeleton overflow-hidden border border-purple-950/80 bg-[#0a0514] shadow-[0_18px_50px_rgba(88,28,135,0.2),inset_0_1px_0_rgba(216,180,254,0.06)]';

type SkeletonBaseProps = {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** Renders a shimmer block without inner layout (use className for size). */
  block?: boolean;
};

/** Dark purple shimmer primitive for Bunny's Whisper loading states. */
export function SkeletonBase({
  className = '',
  style,
  children,
  block = false,
}: SkeletonBaseProps) {
  if (block) {
    return (
      <div
        aria-hidden
        className={`${shimmerBlock} rounded-2xl ${className}`}
        style={style}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`${shimmerCard} rounded-3xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
