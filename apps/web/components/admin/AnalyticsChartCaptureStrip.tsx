'use client';

import { forwardRef } from 'react';
import type { AnalyticsExportStats } from '@/lib/analyticsExport';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#d8b4fe', '#fb7185', '#4ade80', '#f0abfc', '#c4b5fd', '#fde047'];

const CHART_AXIS = {
  stroke: '#a78bfa',
  tick: { fill: '#f3e8ff', fontSize: 12 },
};

const CHART_GRID = { strokeDasharray: '3 3' as const, stroke: '#4c3d66' };

const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: '#160b22',
    border: '1px solid rgba(167, 139, 250, 0.5)',
    borderRadius: '12px',
    color: '#faf5ff',
  },
  labelStyle: { color: '#e9d5ff', fontWeight: 600 as const },
  itemStyle: { color: '#f3e8ff' },
};

const CHART_H = 280;

type Props = {
  stats: AnalyticsExportStats;
};

/** Off-screen duplicate charts for html2canvas — same data as dashboard, unique SVG defs. */
export const AnalyticsChartCaptureStrip = forwardRef<HTMLDivElement, Props>(
  function AnalyticsChartCaptureStrip({ stats }, ref) {
    return (
      <div
        ref={ref}
        className="pointer-events-none absolute left-[-9999px] top-0 z-0 w-[1200px] bg-[#0d0716] p-4 opacity-100"
        aria-hidden
      >
        <div
          data-export-chart="revenue-trend"
          className="mb-6 rounded-2xl border border-purple-950 bg-[#0d0716] p-3"
          style={{ height: CHART_H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.dailyRevenue}>
              <defs>
                <linearGradient id="exportPurpleArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ddd6fe" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} width={45} />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Area
                type="monotone"
                dataKey="revenue"
                isAnimationActive={false}
                stroke="#e9d5ff"
                strokeWidth={2}
                fill="url(#exportPurpleArea)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div
          data-export-chart="best-sellers"
          className="mb-6 rounded-2xl border border-purple-950 bg-[#0d0716] p-3"
          style={{ height: CHART_H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.bestSellers}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis
                dataKey="name"
                stroke={CHART_AXIS.stroke}
                tick={{ ...CHART_AXIS.tick, fontSize: 11 }}
                interval={0}
                angle={-12}
                textAnchor="end"
                height={70}
              />
              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Bar
                dataKey="units"
                isAnimationActive={false}
                fill="#c4b5fd"
                radius={[10, 10, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          data-export-chart="order-status"
          className="mb-6 rounded-2xl border border-purple-950 bg-[#0d0716] p-3"
          style={{ height: CHART_H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.pieStatus}
                dataKey="value"
                isAnimationActive={false}
                outerRadius={95}
                label
              >
                {stats.pieStatus.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    stroke="#1a1028"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div
          data-export-chart="payment-methods"
          className="mb-6 rounded-2xl border border-purple-950 bg-[#0d0716] p-3"
          style={{ height: CHART_H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats.piePayment}
                dataKey="value"
                isAnimationActive={false}
                outerRadius={95}
                label
              >
                {stats.piePayment.map((_, i) => (
                  <Cell
                    key={i}
                    fill={COLORS[i % COLORS.length]}
                    stroke="#1a1028"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_PROPS} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div
          data-export-chart="size-demand"
          className="mb-6 rounded-2xl border border-purple-950 bg-[#0d0716] p-3"
          style={{ height: CHART_H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.sizeDemand}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="name" stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Bar
                dataKey="units"
                isAnimationActive={false}
                fill="#f0abfc"
                radius={[10, 10, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          data-export-chart="color-demand"
          className="mb-6 rounded-2xl border border-purple-950 bg-[#0d0716] p-3"
          style={{ height: CHART_H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.colorDemand}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="name" stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Bar
                dataKey="units"
                isAnimationActive={false}
                fill="#d8b4fe"
                radius={[10, 10, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          data-export-chart="top-cities"
          className="rounded-2xl border border-purple-950 bg-[#0d0716] p-3"
          style={{ height: CHART_H }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.cities}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis
                dataKey="name"
                stroke={CHART_AXIS.stroke}
                tick={{ ...CHART_AXIS.tick, fontSize: 11 }}
                interval={0}
                angle={-12}
                textAnchor="end"
                height={65}
              />
              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Bar
                dataKey="orders"
                isAnimationActive={false}
                fill="#a78bfa"
                radius={[10, 10, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  },
);
