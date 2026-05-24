'use client';

import { useEffect, useState } from 'react';
import type {
  AnalyticsChartCaptureId,
  AnalyticsExportStats,
} from '@/lib/analyticsExport';
import { ANALYTICS_CHART_CAPTURE_IDS, formatCurrency, formatPercent } from '@/lib/analyticsExport';
import { formatIsoUtcDateTime } from '@/lib/formatIsoDate';
import { interactivePressable } from '@/lib/interactivePressable';

const CHART_LABELS: Record<AnalyticsChartCaptureId, string> = {
  'revenue-trend': 'Revenue trend',
  'best-sellers': 'Best sellers',
  'order-status': 'Order status',
  'payment-methods': 'Payment methods',
  'size-demand': 'Size demand',
  'color-demand': 'Color demand',
  'top-cities': 'Top cities',
  'event-qr-revenue': 'Event QR — revenue by campaign',
  'event-qr-redemptions': 'Event QR — redemptions by campaign',
};

type AnalyticsExportPreviewProps = {
  open: boolean;
  onClose: () => void;
  stats: AnalyticsExportStats;
  /** e.g. All time, May 2026 */
  periodLabel: string;
  /** Current analytics tab label */
  dashboardTabLabel: string;
  csvText: string;
  chartImages: Partial<Record<AnalyticsChartCaptureId, string>>;
  chartErrors: Partial<Record<AnalyticsChartCaptureId, string>>;
  captureStatus: 'idle' | 'loading' | 'ready';
  insights: string[];
  onDownloadPdf: () => Promise<void>;
  onDownloadCsv: () => void;
};

const btnPrimary = `inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-purple-300 bg-purple-300 px-4 py-2.5 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-6 sm:text-sm ${interactivePressable}`;
const btnGhost = `inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-purple-800/80 bg-[#0d0716] px-4 py-2.5 text-xs font-bold text-purple-100 sm:flex-none sm:px-5 sm:text-sm ${interactivePressable}`;

function PreviewTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-purple-950/80 bg-[#07030d]">
      <p className="border-b border-purple-950/80 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-200 sm:px-4 sm:text-xs">
        {title}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-xs text-gray-200 sm:text-sm">
          <thead>
            <tr className="border-b border-purple-950/60 bg-[#0a0514] text-[10px] font-bold uppercase tracking-wide text-purple-300">
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 sm:px-4">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, ri) => (
              <tr
                key={ri}
                className="border-b border-purple-950/40 last:border-0 odd:bg-[#05030a]/80"
              >
                {cells.map((c, ci) => (
                  <td key={ci} className="max-w-40 px-3 py-2 sm:px-4">
                    <span className="wrap-break-word">{c}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AnalyticsExportPreview({
  open,
  onClose,
  stats,
  periodLabel,
  dashboardTabLabel,
  csvText,
  chartImages,
  chartErrors,
  captureStatus,
  insights,
  onDownloadPdf,
  onDownloadCsv,
}: AnalyticsExportPreviewProps) {
  const [generatedIso, setGeneratedIso] = useState('');

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setGeneratedIso('');
      return;
    }
    setGeneratedIso(new Date().toISOString());
  }, [open]);

  if (!open) return null;

  const generatedAt = generatedIso ? formatIsoUtcDateTime(generatedIso) : '…';

  const summaryRows: (string | number)[][] = [
    ['Gross order value', formatCurrency(stats.grossOrderValue)],
    ['Paid revenue', formatCurrency(stats.paidRevenue)],
    ['Delivered order value', formatCurrency(stats.deliveredRevenue)],
    ['Pending order value', formatCurrency(stats.pendingOrderValue)],
    [
      'COD outstanding',
      `${stats.codOutstandingCount} · ${formatCurrency(stats.codOutstandingValue)}`,
    ],
    [
      'Failed/expired payments',
      `${stats.failedExpiredPaymentsCount} total (${stats.expiredPaymentsCount} expired, ${stats.failedPaymentsCount} failed)`,
    ],
    ['Failed/expired value', formatCurrency(stats.failedExpiredPaymentsValue)],
    ['Non-cancelled orders', String(stats.nonCancelledOrderCount)],
    ['Total orders in period', stats.totalOrders],
    ['Average order (gross)', formatCurrency(stats.avgOrderValue)],
    ['Discounts', formatCurrency(stats.totalDiscounts)],
    ['Cancel rate', formatPercent(stats.cancelRate)],
    ['Coupon usage', formatPercent(stats.couponUsageRate)],
  ];

  const abandonedRows: (string | number)[][] = [
    ['Total tracked carts', stats.cartsTotal],
    ['Recovered after reminders', stats.cartsRecovered],
    ['Expired carts', stats.cartsExpired],
    ['Email reminders sent', stats.emailReminders],
    ['WhatsApp reminders sent', stats.whatsappReminders],
  ];

  return (
    <div
      className="fixed inset-0 z-10000 flex items-end justify-center bg-black/75 p-3 pb-5 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-export-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close export preview"
        onClick={onClose}
      />

      <div
        className="relative z-1 flex max-h-[min(92vh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-purple-400/30 bg-[#0d0716] shadow-[0_24px_80px_rgba(0,0,0,0.85)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-purple-950/80 bg-linear-to-r from-[#12081f] to-[#0d0716] px-4 py-4 sm:px-6 sm:py-5">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-purple-300 sm:text-xs">
            Export preview
          </p>
          <h2
            id="analytics-export-title"
            className="mt-2 text-xl font-black text-white sm:text-2xl"
          >
            Bunny&apos;s Whisper Analytics Report
          </h2>
          <p className="mt-1 text-xs text-gray-400 sm:text-sm">
            Generated {generatedAt}
          </p>
          <p className="mt-2 text-xs text-purple-200/90 sm:text-sm">
            <span className="font-semibold text-purple-100">Selected period:</span>{' '}
            {periodLabel}
            <span className="text-gray-500"> · </span>
            <span className="font-semibold text-purple-100">Dashboard tab:</span>{' '}
            {dashboardTabLabel}
          </p>
          {captureStatus === 'loading' && (
            <p className="mt-2 text-xs font-semibold text-amber-200">
              Preparing chart snapshots for PDF…
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">
                Chart previews (PDF)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ANALYTICS_CHART_CAPTURE_IDS.map((id) => (
                  <div
                    key={id}
                    className="overflow-hidden rounded-2xl border border-purple-950/80 bg-[#07030d]"
                  >
                    <p className="border-b border-purple-950/60 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-purple-200">
                      {CHART_LABELS[id]}
                    </p>
                    <div className="flex min-h-[140px] items-center justify-center bg-[#05030a] p-2">
                      {chartImages[id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={chartImages[id]}
                          alt=""
                          className="max-h-40 w-full object-contain"
                        />
                      ) : (
                        <span className="px-2 text-center text-xs text-gray-500">
                          {captureStatus === 'loading'
                            ? 'Capturing…'
                            : (chartErrors[id] ?? 'Capture unavailable for this chart')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-purple-300">
                CSV preview
              </p>
              <textarea
                readOnly
                value={csvText.replace(/^\uFEFF/, '')}
                className="h-48 w-full resize-y rounded-2xl border border-purple-950 bg-[#05030a] p-3 font-mono text-[11px] leading-relaxed text-gray-200 outline-none focus:border-purple-400/60 sm:h-56 sm:text-xs"
                spellCheck={false}
              />
            </div>

            <div className="space-y-5">
              <PreviewTable
                title="Insights"
                headers={['Insight']}
                rows={insights.map((line) => [line])}
              />

              <PreviewTable
                title="Summary metrics"
                headers={['Metric', 'Value']}
                rows={summaryRows}
              />

              <PreviewTable
                title="Abandoned cart recovery"
                headers={['Metric', 'Value']}
                rows={abandonedRows}
              />

              <PreviewTable
                title="Order status"
                headers={['Status', 'Orders']}
                rows={stats.pieStatus.map((r) => [r.name, r.value])}
              />

              <PreviewTable
                title="Payment methods"
                headers={['Method', 'Orders']}
                rows={stats.piePayment.map((r) => [r.name, r.value])}
              />

              <PreviewTable
                title="Daily revenue"
                headers={['Day', 'Revenue']}
                rows={stats.dailyRevenue.map((r) => [
                  r.day,
                  formatCurrency(r.revenue),
                ])}
              />

              <PreviewTable
                title="Best sellers"
                headers={['Product', 'Units']}
                rows={stats.bestSellers.map((r) => [r.name, r.units])}
              />

              <PreviewTable
                title="Size demand"
                headers={['Size', 'Units']}
                rows={stats.sizeDemand.map((r) => [r.name, r.units])}
              />

              <PreviewTable
                title="Color demand"
                headers={['Color', 'Units']}
                rows={stats.colorDemand.map((r) => [r.name, r.units])}
              />

              <PreviewTable
                title="Top cities"
                headers={['City', 'Orders']}
                rows={stats.cities.map((r) => [r.name, r.orders])}
              />

              <PreviewTable
                title="VIP customers"
                headers={['#', 'Name', 'Email', 'Total', 'Orders']}
                rows={stats.topCustomers.map((r, i) => [
                  i + 1,
                  r.name,
                  r.email,
                  formatCurrency(r.total),
                  r.orders,
                ])}
              />
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-purple-950/80 bg-[#07030d] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
            <button type="button" onClick={onClose} className={btnGhost}>
              Cancel
            </button>
            <button
              type="button"
              disabled={captureStatus === 'loading'}
              onClick={async () => {
                await onDownloadPdf();
                onClose();
              }}
              className={btnPrimary}
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => {
                onDownloadCsv();
                onClose();
              }}
              className={btnPrimary}
            >
              Download CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
