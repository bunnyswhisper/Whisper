'use client';

import { forwardRef, type CSSProperties } from 'react';
import type { AnalyticsExportStats } from '@/lib/analyticsExport';
import {
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

const COLORS = ['#a855f7', '#ec4899', '#22c55e', '#c084fc', '#8b5cf6', '#f59e0b'];

const CHART_AXIS = {
  stroke: '#6b7280',
  tick: { fill: '#d1d5db', fontSize: 12 },
};

const CHART_GRID = { strokeDasharray: '3 3' as const, stroke: '#374151' };

const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: '#12081f',
    border: '1px solid #6b21a8',
    borderRadius: '12px',
    color: '#ffffff',
  },
  labelStyle: { color: '#ffffff', fontWeight: 600 as const },
  itemStyle: { color: '#ffffff' },
};

const CHART_H = 280;

type Props = {
  stats: AnalyticsExportStats;
};

const chartCardStyle: CSSProperties = {
  width: 1168,
  height: CHART_H,
  marginBottom: 24,
  borderRadius: 16,
  border: '1px solid #6b21a8',
  backgroundColor: '#0b0612',
  color: '#ffffff',
  padding: 12,
};

/** Dedicated export-only chart renderer for html2canvas snapshots. */
export const AnalyticsExportCharts = forwardRef<HTMLDivElement, Props>(
  function AnalyticsExportCharts({ stats }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          width: 1200,
          minHeight: 2000,
          background: '#0b0612',
          color: '#fff',
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 1,
          visibility: 'visible',
          padding: 16,
        }}
      >
        <div
          data-export-chart="revenue-trend"
          style={chartCardStyle}
        >
          <AreaChart width={1140} height={CHART_H - 24} data={stats.dailyRevenue}>
              <defs>
                <linearGradient id="exportPurpleAreaV2" x1="0" y1="0" x2="0" y2="1">
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
                animationDuration={0}
                stroke="#c084fc"
                strokeWidth={2}
                fill="url(#exportPurpleAreaV2)"
              />
          </AreaChart>
        </div>

        <div
          data-export-chart="best-sellers"
          style={chartCardStyle}
        >
          <BarChart width={1140} height={CHART_H - 24} data={stats.bestSellers}>
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
                animationDuration={0}
                fill="#a855f7"
                radius={[10, 10, 0, 0]}
              />
          </BarChart>
        </div>

        <div
          data-export-chart="order-status"
          style={chartCardStyle}
        >
          <PieChart width={1140} height={CHART_H - 24}>
              <Pie
                data={stats.pieStatus}
                dataKey="value"
                isAnimationActive={false}
                animationDuration={0}
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
        </div>

        <div
          data-export-chart="payment-methods"
          style={chartCardStyle}
        >
          <PieChart width={1140} height={CHART_H - 24}>
              <Pie
                data={stats.piePayment}
                dataKey="value"
                isAnimationActive={false}
                animationDuration={0}
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
        </div>

        <div
          data-export-chart="size-demand"
          style={chartCardStyle}
        >
          <BarChart width={1140} height={CHART_H - 24} data={stats.sizeDemand}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="name" stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Bar
                dataKey="units"
                isAnimationActive={false}
                animationDuration={0}
                fill="#c084fc"
                radius={[10, 10, 0, 0]}
              />
          </BarChart>
        </div>

        <div
          data-export-chart="color-demand"
          style={chartCardStyle}
        >
          <BarChart width={1140} height={CHART_H - 24} data={stats.colorDemand}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="name" stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} />
              <Tooltip {...CHART_TOOLTIP_PROPS} />
              <Bar
                dataKey="units"
                isAnimationActive={false}
                animationDuration={0}
                fill="#a855f7"
                radius={[10, 10, 0, 0]}
              />
          </BarChart>
        </div>

        <div
          data-export-chart="top-cities"
          style={{
            ...chartCardStyle,
            marginBottom: 0,
          }}
        >
          <BarChart width={1140} height={CHART_H - 24} data={stats.cities}>
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
                animationDuration={0}
                fill="#a855f7"
                radius={[10, 10, 0, 0]}
              />
          </BarChart>
        </div>

        <div data-export-chart="event-qr-revenue" style={chartCardStyle}>
          <BarChart
            width={1140}
            height={CHART_H - 24}
            data={stats.eventQr.chartRevenueByCampaign}
          >
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
            <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} width={52} />
            <Tooltip {...CHART_TOOLTIP_PROPS} />
            <Bar
              dataKey="revenue"
              isAnimationActive={false}
              animationDuration={0}
              fill="#c4b5fd"
              radius={[10, 10, 0, 0]}
            />
          </BarChart>
        </div>

        <div
          data-export-chart="event-qr-redemptions"
          style={{ ...chartCardStyle, marginBottom: 0 }}
        >
          <BarChart
            width={1140}
            height={CHART_H - 24}
            data={stats.eventQr.chartRedemptionsByCampaign}
          >
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
            <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} width={48} />
            <Tooltip {...CHART_TOOLTIP_PROPS} />
            <Bar
              dataKey="redemptions"
              isAnimationActive={false}
              animationDuration={0}
              fill="#f0abfc"
              radius={[10, 10, 0, 0]}
            />
          </BarChart>
        </div>
      </div>
    );
  },
);
