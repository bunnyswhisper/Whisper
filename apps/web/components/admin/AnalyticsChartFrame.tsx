'use client';

import type { ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

export const ANALYTICS_CHART_HEIGHT = 280;

type AnalyticsChartFrameProps = {
  children: ReactElement;
  height?: number;
  className?: string;
  /** Wider minimum width for horizontal-scroll chart rows on small screens. */
  scrollMinWidth?: number;
};

/**
 * Sized wrapper for Recharts — avoids width(-1)/height(-1) when parent has no layout box.
 */
export function AnalyticsChartFrame({
  children,
  height = ANALYTICS_CHART_HEIGHT,
  className = '',
  scrollMinWidth,
}: AnalyticsChartFrameProps) {
  const minWidthStyle =
    scrollMinWidth != null ? { minWidth: scrollMinWidth } : undefined;

  return (
    <div
      className={`relative h-[260px] min-h-[240px] w-full min-w-0 sm:h-[300px] sm:min-h-[280px] lg:h-[320px] lg:min-h-[300px] ${className}`}
      style={minWidthStyle}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minHeight={240}
        minWidth={scrollMinWidth ?? 260}
        initialDimension={{ width: 400, height }}
      >
        {children}
      </ResponsiveContainer>
    </div>
  );
}
