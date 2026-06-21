'use client';

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import { apiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabaseClient';
import {
  ANALYTICS_CHART_CAPTURE_IDS,
  type AnalyticsChartCaptureId,
  buildAnalyticsCsv,
  buildAnalyticsEventQrBlock,
  captureAnalyticsChartImages,
  generateAnalyticsPdf,
  triggerAnalyticsCsvDownload,
} from '@/lib/analyticsExport';
import { interactivePressable } from '@/lib/interactivePressable';
import {
  computeAdminOrderRollups,
  getAdminOrderTotal,
  isNonCancelledOrder,
} from '@/lib/adminOrderMetrics';
import AdminOnly from '@/components/AdminOnly';
import { AdminSectionTabs } from '@/components/admin/AdminSectionTabs';
import { MetricCard } from '@/components/admin/MetricCard';
import {
  LazySection,
  SkeletonAnalyticsCard,
  SkeletonAnalyticsDashboard,
} from '@/components/skeleton';
import { AnalyticsExportPreview } from '@/components/admin/AnalyticsExportPreview';
import { AnalyticsChartFrame } from '@/components/admin/AnalyticsChartFrame';
import { AnalyticsExportCharts } from '@/components/admin/AnalyticsExportCharts';
import { AdminWishlistAnalyticsPanel } from '@/components/admin/AdminWishlistAnalyticsPanel';
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

type OrderItem = {
  id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  total_price: number;
};

type Order = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  total: number;
  subtotal: number;
  discount_amount?: number | null;
  discount_source?: string | null;
  event_campaign_id?: string | null;
  event_discount_percent?: number | null;
  coupon_code?: string | null;
  status: string;
  payment_method: string;
  payment_status: string;
  city: string;
  created_at: string;
  order_items: OrderItem[];
};

type AbandonedCart = {
  id: string;
  status: string;
  subtotal: number;
  reminder_count: number;
  first_reminder_sent_at: string | null;
  second_reminder_sent_at: string | null;
  whatsapp_first_sent_at: string | null;
  whatsapp_second_sent_at: string | null;
  completed_at: string | null;
  expired_at: string | null;
};
type Coupon = {
  id: string;
  code: string;
  discount_percent: number;
  points_cost: number;
  is_used: boolean;
  status: string;
  source: string | null;
  created_at: string;
  used_at: string | null;
  expires_at?: string | null;
};
type EventQrCampaignApiRow = {
  id: string;
  name: string;
  code: string;
  discount_percent: number;
  active: boolean;
  redemption_count: number;
  used_count: number;
  revenue_egp: number;
  discount_given_egp: number;
};

type AnalyticsExtra = {
  abandonedCarts: AbandonedCart[];
  coupons: Coupon[];
  points: any[];
  eventQrCampaigns: EventQrCampaignApiRow[];
};

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

/** Product / inventory bar charts — angled labels to reduce overlap on narrow widths. */
const CHART_AXIS_X_COMPACT = {
  stroke: CHART_AXIS.stroke,
  tick: { fill: '#f3e8ff', fontSize: 10 },
  interval: 0 as const,
  angle: -18,
  textAnchor: 'end' as const,
  height: 72,
};

const PRODUCTS_CHART_CARD =
  'w-[min(92vw,360px)] shrink-0 snap-center md:w-auto md:min-w-0 md:snap-none';

const ANALYTICS_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'revenue', label: 'Revenue & Sales' },
  { id: 'orders', label: 'Orders & Payments' },
  { id: 'products', label: 'Products & Inventory' },
  { id: 'customers', label: 'Customers & Locations' },
  { id: 'event-qr', label: 'Event QR' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'abandoned', label: 'Abandoned Carts' },
] as const;

type AnalyticsSectionId = (typeof ANALYTICS_SECTIONS)[number]['id'];

function money(v: number) {
  return `EGP ${Number(v || 0).toFixed(0)}`;
}

function dayKey(date: string) {
  return new Date(date).toISOString().slice(0, 10);
}

function labelDay(key: string) {
  const d = new Date(key);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
}

/** Local calendar month key YYYY-MM from order timestamp. */
function orderMonthKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthOptionLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function prevMonthKey(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return null;
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Lets export-preview charts lay out before html2canvas (replaces fixed delays where safe). */
function waitNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

const exportBtnClass = `inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-purple-300/55 bg-purple-500/15 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-purple-100 sm:flex-none sm:text-sm ${interactivePressable}`;

const monthSelectClass = `min-h-11 w-full max-w-xs cursor-pointer rounded-full border border-purple-950 bg-[#0d0716] px-4 py-2.5 text-sm font-semibold text-purple-100 outline-none transition hover:border-purple-400/55 focus:border-purple-300 sm:w-auto ${interactivePressable}`;

export default function AdminAnalyticsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [extra, setExtra] = useState<AnalyticsExtra>({
    abandonedCarts: [],
    coupons: [],
    points: [],
    eventQrCampaigns: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] =
    useState<AnalyticsSectionId>('overview');
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [monthKey, setMonthKey] = useState<'all' | string>('all');
  const [chartImages, setChartImages] = useState<
    Partial<Record<AnalyticsChartCaptureId, string>>
  >({});
  const [chartCaptureErrors, setChartCaptureErrors] = useState<
    Partial<Record<AnalyticsChartCaptureId, string>>
  >({});
  const [captureStatus, setCaptureStatus] = useState<'idle' | 'loading' | 'ready'>(
    'idle',
  );
  const chartStripRef = useRef<HTMLDivElement>(null);

  async function loadData() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const [ordersRes, extraRes] = await Promise.all([
        fetch(apiUrl('/admin/orders'), {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
        fetch(apiUrl('/admin/analytics-extra'), {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
      ]);

      const [ordersData, extraData] = await Promise.all([
        ordersRes.json(),
        extraRes.json(),
      ]);

      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setExtra({
        abandonedCarts: Array.isArray(extraData.abandonedCarts)
          ? extraData.abandonedCarts
          : [],
        coupons: Array.isArray(extraData.coupons) ? extraData.coupons : [],
        points: Array.isArray(extraData.points) ? extraData.points : [],
        eventQrCampaigns: Array.isArray(extraData.eventQrCampaigns)
          ? extraData.eventQrCampaigns
          : [],
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    orders.forEach((o) => {
      const k = orderMonthKey(o.created_at);
      if (k) keys.add(k);
    });
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (monthKey === 'all') return orders;
    return orders.filter((o) => orderMonthKey(o.created_at) === monthKey);
  }, [orders, monthKey]);

  const stats = useMemo(() => {
    const activeOrders = filteredOrders.filter(isNonCancelledOrder);
    const cancelledOrders = filteredOrders.filter(
      (o) => String(o.status).toLowerCase() === 'cancelled',
    );
    const rollups = computeAdminOrderRollups(filteredOrders);

    const totalDiscounts = activeOrders.reduce(
      (sum, o) => sum + Number(o.discount_amount || 0),
      0,
    );

    const dailyMap: Record<string, number> = {};
    const cityMap: Record<string, number> = {};
    const statusMap: Record<string, number> = {};
    const paymentMap: Record<string, number> = {};
    const productMap: Record<string, number> = {};
    const sizeMap: Record<string, number> = {};
    const colorMap: Record<string, number> = {};
    const customerMap: Record<
      string,
      { name: string; email: string; total: number; orders: number }
    > = {};

    activeOrders.forEach((order) => {
      const key = dayKey(order.created_at);
      dailyMap[key] = (dailyMap[key] || 0) + getAdminOrderTotal(order);

      cityMap[order.city || 'Unknown'] = (cityMap[order.city || 'Unknown'] || 0) + 1;
      statusMap[order.status] = (statusMap[order.status] || 0) + 1;
      paymentMap[order.payment_method || 'Unknown'] =
        (paymentMap[order.payment_method || 'Unknown'] || 0) + 1;

      const customerKey = order.customer_email || order.customer_name || order.id;
      customerMap[customerKey] = customerMap[customerKey] || {
        name: order.customer_name || 'Unknown',
        email: order.customer_email || 'No email',
        total: 0,
        orders: 0,
      };

      customerMap[customerKey].total += getAdminOrderTotal(order);
      customerMap[customerKey].orders += 1;

      order.order_items?.forEach((item) => {
        productMap[item.product_name] =
          (productMap[item.product_name] || 0) + Number(item.quantity || 0);
        sizeMap[item.size] = (sizeMap[item.size] || 0) + Number(item.quantity || 0);
        colorMap[item.color] =
          (colorMap[item.color] || 0) + Number(item.quantity || 0);
      });
    });

    const nonCancelledOrders = filteredOrders.filter(
      (o) => o.status !== 'cancelled',
    );

    const pointsCoupons = extra.coupons.filter(
      (c) => c.source === 'points' || !c.source,
    );
    const couponsCreated =
      monthKey === 'all'
        ? pointsCoupons.length
        : pointsCoupons.filter((c) => {
            if (!c.created_at) return false;
            return orderMonthKey(c.created_at) === monthKey;
          }).length;

    const usedCouponCodesFromRealOrders = new Set(
      nonCancelledOrders
        .filter((o) => o.coupon_code)
        .map((o) => o.coupon_code!.trim().toUpperCase()),
    );

    const couponsUsed = extra.coupons.filter((c) =>
      usedCouponCodesFromRealOrders.has(c.code?.trim().toUpperCase()),
    ).length;

    const carts = extra.abandonedCarts;
    const cartsWithEmail = carts.filter(
      (c) => c.first_reminder_sent_at || c.second_reminder_sent_at,
    ).length;
    const cartsWithWhatsApp = carts.filter(
      (c) => c.whatsapp_first_sent_at || c.whatsapp_second_sent_at,
    ).length;
    const expiredCarts = carts.filter((c) => c.status === 'expired').length;
    const recoveredCarts = carts.filter(
      (c) => c.reminder_count > 0 && c.status === 'completed',
    ).length;

    const topCustomers = Object.values(customerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const eventQr = buildAnalyticsEventQrBlock(activeOrders, extra.eventQrCampaigns);

    const highDemandProductCount = Object.entries(productMap).filter(
      ([, units]) => units >= 10,
    ).length;

    return {
      ...rollups,
      totalOrders: filteredOrders.length,
      cancelRate: filteredOrders.length
        ? (cancelledOrders.length / filteredOrders.length) * 100
        : 0,
      totalDiscounts,
      highDemandProductCount,
      couponUsageRate:
        couponsCreated > 0 ? (couponsUsed / couponsCreated) * 100 : 0,
      cartsTotal: carts.length,
      cartsRecovered: recoveredCarts,
      cartsExpired: expiredCarts,
      emailReminders: cartsWithEmail,
      whatsappReminders: cartsWithWhatsApp,
      dailyRevenue: Object.entries(dailyMap)
        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
        .map(([day, revenue]) => ({ day: labelDay(day), revenue })),
      cities: Object.entries(cityMap)
        .map(([name, orders]) => ({ name, orders }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 8),
      pieStatus: Object.entries(statusMap).map(([name, value]) => ({ name, value })),
      piePayment: Object.entries(paymentMap).map(([name, value]) => ({ name, value })),
      bestSellers: Object.entries(productMap)
        .map(([name, units]) => ({ name, units }))
        .sort((a, b) => b.units - a.units)
        .slice(0, 8),
      sizeDemand: Object.entries(sizeMap).map(([name, units]) => ({ name, units })),
      colorDemand: Object.entries(colorMap).map(([name, units]) => ({ name, units })),
      topCustomers,
      eventQr,
    };
  }, [filteredOrders, extra, monthKey]);

  const periodDisplay =
    monthKey === 'all' ? 'All time' : formatMonthOptionLabel(monthKey);

  const dashboardTabLabel =
    activeSection === 'overview'
      ? 'Overview'
      : ANALYTICS_SECTIONS.find((s) => s.id === activeSection)?.label ??
        'Overview';

  const csvText = useMemo(
    () => buildAnalyticsCsv(stats, { periodLabel: periodDisplay }),
    [stats, periodDisplay],
  );

  const previousMonthStats = useMemo(() => {
    if (monthKey === 'all') return null;
    const prev = prevMonthKey(monthKey);
    if (!prev) return null;
    const prevOrders = orders.filter((o) => orderMonthKey(o.created_at) === prev);
    const prevRollups = computeAdminOrderRollups(prevOrders);
    return {
      label: formatMonthOptionLabel(prev),
      grossOrderValue: prevRollups.grossOrderValue,
      paidRevenue: prevRollups.paidRevenue,
      orders: prevOrders.length,
      avgOrderValue: prevRollups.avgOrderValue,
    };
  }, [monthKey, orders]);

  function changePct(current: number, previous: number) {
    if (!previous) return null;
    return ((current - previous) / previous) * 100;
  }

  const ceoInsights = useMemo(() => {
    const topProduct = stats.bestSellers[0]?.name || '—';
    const topCity = stats.cities[0]?.name || '—';
    const topSize = stats.sizeDemand[0]?.name || '—';
    const biggestRevenueDay =
      stats.dailyRevenue.slice().sort((a, b) => b.revenue - a.revenue)[0];
    const highDemandProductCount = stats.highDemandProductCount;
    const cancelledImpact =
      (stats.cancelRate / 100) * stats.grossOrderValue;
    const deliveredShare = stats.grossOrderValue
      ? (stats.deliveredRevenue / stats.grossOrderValue) * 100
      : 0;
    const paidShare = stats.grossOrderValue
      ? (stats.paidRevenue / stats.grossOrderValue) * 100
      : 0;
    return {
      topProduct,
      topCity,
      topSize,
      biggestRevenueDay: biggestRevenueDay?.day || '—',
      highDemandProductCount,
      cancelledImpact,
      deliveredShare,
      paidShare,
    };
  }, [stats]);

  const exportInsights = useMemo(() => {
    const insights: string[] = [];
    const previousLabel = previousMonthStats?.label ?? 'previous period';
    const revenueDelta =
      previousMonthStats == null
        ? null
        : changePct(stats.grossOrderValue, previousMonthStats.grossOrderValue);
    if (revenueDelta != null) {
      const direction = revenueDelta >= 0 ? 'increased' : 'decreased';
      insights.push(
        `Revenue ${direction} ${Math.abs(revenueDelta).toFixed(1)}% vs ${previousLabel}.`,
      );
    }
    insights.push(`Top product this period: ${ceoInsights.topProduct}.`);
    insights.push(`Most requested size: ${ceoInsights.topSize}.`);
    insights.push(`Highest demand city: ${ceoInsights.topCity}.`);
    const failedRate =
      stats.totalOrders > 0
        ? (stats.failedExpiredPaymentsCount / stats.totalOrders) * 100
        : 0;
    insights.push(
      `Failed/expired: ${stats.failedExpiredPaymentsCount} total (${stats.expiredPaymentsCount} expired, ${stats.failedPaymentsCount} failed) — ${money(stats.failedExpiredPaymentsValue)} (${failedRate.toFixed(1)}% of period orders).`,
    );
    const eq = stats.eventQr;
    if (eq.eventOrdersInPeriod > 0) {
      insights.push(
        `Event QR booth: ${eq.eventOrdersInPeriod} orders, ${money(eq.eventRevenueInPeriod)} revenue; top campaign ${eq.bestCampaignName} (${eq.bestCampaignOrders} orders).`,
      );
    } else if (eq.hasCampaigns) {
      insights.push('Event QR campaigns exist; no booth-tagged orders in this period yet.');
    }
    return insights;
  }, [previousMonthStats, stats, ceoInsights]);

  useEffect(() => {
    if (!exportPreviewOpen) {
      setCaptureStatus('idle');
      setChartImages({});
      setChartCaptureErrors({});
      return;
    }
    setCaptureStatus('loading');
    let cancelled = false;

    void (async () => {
      await waitNextPaint();
      let result = await captureAnalyticsChartImages(chartStripRef.current);
      // Retry capture a few times so chart snapshots are ready for preview/PDF.
      for (
        let i = 0;
        i < 2 &&
        Object.keys(result.images).length < ANALYTICS_CHART_CAPTURE_IDS.length;
        i += 1
      ) {
        await waitNextPaint();
        const next = await captureAnalyticsChartImages(chartStripRef.current);
        result = {
          images: { ...result.images, ...next.images },
          errors: { ...result.errors, ...next.errors },
        };
      }
      if (!cancelled) {
        setChartImages(result.images);
        setChartCaptureErrors(result.errors);
        setCaptureStatus('ready');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exportPreviewOpen, stats]);

  async function handleExportPdfDownload() {
    let result = await captureAnalyticsChartImages(chartStripRef.current);
    if (Object.keys(result.images).length < ANALYTICS_CHART_CAPTURE_IDS.length) {
      await waitNextPaint();
      const retry = await captureAnalyticsChartImages(chartStripRef.current);
      result = {
        images: { ...result.images, ...retry.images },
        errors: { ...result.errors, ...retry.errors },
      };
    }
    setChartCaptureErrors(result.errors);
    generateAnalyticsPdf(stats, {
      periodLabel: periodDisplay,
      images: { ...chartImages, ...result.images },
      insights: exportInsights,
    });
  }

  function handleExportCsvDownload() {
    triggerAnalyticsCsvDownload(stats, { periodLabel: periodDisplay });
  }

  if (loading) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] py-5 text-white sm:px-6 sm:py-8 lg:py-10">
        <Navbar />
        <SkeletonAnalyticsDashboard />
      </main>
    );
  }

  return (
    <AdminOnly>
      <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] py-5 text-white sm:px-6 sm:py-8 lg:py-10">
        <Navbar />

        <section className="mx-auto max-w-7xl">
          <h1 className="bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl lg:text-5xl">
            Bunny’s Whisper Analytics
          </h1>

          <p className="mt-3 text-sm text-gray-400 sm:text-base">
            Founder luxury control room — revenue, customers, products, recovery.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row sm:items-center sm:gap-4">
            <label
              htmlFor="analytics-month-filter"
              className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300 sm:text-xs"
            >
              Period
            </label>
            <select
              id="analytics-month-filter"
              value={monthKey}
              onChange={(e) =>
                setMonthKey(
                  e.target.value === 'all' ? 'all' : e.target.value,
                )
              }
              className={monthSelectClass}
            >
              <option value="all">All time</option>
              {monthOptions.map((k) => (
                <option key={k} value={k}>
                  {formatMonthOptionLabel(k)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex flex-col gap-4 sm:mt-8 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0 flex-1">
              <AdminSectionTabs
                tabs={[...ANALYTICS_SECTIONS]}
                activeId={activeSection}
                onChange={(id) => setActiveSection(id as AnalyticsSectionId)}
              />
            </div>

            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:justify-end">
              <button
                type="button"
                onClick={() => setExportPreviewOpen(true)}
                className={exportBtnClass}
              >
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => setExportPreviewOpen(true)}
                className={exportBtnClass}
              >
                Export CSV
              </button>
            </div>
          </div>

          {exportPreviewOpen ? (
            <AnalyticsExportCharts ref={chartStripRef} stats={stats} />
          ) : null}

          <AnalyticsExportPreview
            open={exportPreviewOpen}
            onClose={() => setExportPreviewOpen(false)}
            stats={stats}
            periodLabel={periodDisplay}
            dashboardTabLabel={dashboardTabLabel}
            csvText={csvText}
            chartImages={chartImages}
            chartErrors={chartCaptureErrors}
            captureStatus={captureStatus}
            insights={exportInsights}
            onDownloadPdf={handleExportPdfDownload}
            onDownloadCsv={handleExportCsvDownload}
          />

          {activeSection === 'overview' ? (
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <MetricCard
                  title="Gross Order Value"
                  hint="Non-cancelled pipeline total — not cash collected."
                  value={money(stats.grossOrderValue)}
                  glow
                />
                <MetricCard
                  title="Paid Revenue"
                  hint="payment_status = paid (Paymob + marked-paid COD)."
                  value={money(stats.paidRevenue)}
                />
                <MetricCard
                  title="Delivered Order Value"
                  hint="status = delivered — fulfillment value, not always cash."
                  value={money(stats.deliveredRevenue)}
                />
                <MetricCard
                  title="Pending Order Value"
                  hint="Open pipeline: unpaid/pending, not failed or expired."
                  value={money(stats.pendingOrderValue)}
                />
                <MetricCard
                  title="COD Outstanding"
                  hint={`${stats.codOutstandingCount} unpaid COD orders`}
                  value={money(stats.codOutstandingValue)}
                />
                <MetricCard
                  title="Failed / Expired"
                  hint="payment_status in selected period"
                  value={String(stats.failedExpiredPaymentsCount)}
                  detail={`Expired ${stats.expiredPaymentsCount} · Failed ${stats.failedPaymentsCount} · ${money(stats.failedExpiredPaymentsValue)} total`}
                />
                <MetricCard title="Orders (period)" value={String(stats.totalOrders)} />
                <MetricCard
                  title="Avg Order (Gross)"
                  hint="Gross order value ÷ non-cancelled count"
                  value={money(stats.avgOrderValue)}
                />
                <MetricCard
                  title="Cancel Rate"
                  value={`${stats.cancelRate.toFixed(1)}%`}
                />
                <MetricCard
                  title="Coupon Usage"
                  value={`${stats.couponUsageRate.toFixed(1)}%`}
                  glow
                />
              </div>
              {previousMonthStats ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <MetricCard
                    title={`Revenue vs ${previousMonthStats.label}`}
                    value={
                      changePct(
                        stats.grossOrderValue,
                        previousMonthStats.grossOrderValue,
                      ) == null
                        ? '—'
                        : `${changePct(stats.grossOrderValue, previousMonthStats.grossOrderValue)!.toFixed(1)}%`
                    }
                  />
                  <MetricCard
                    title={`Orders vs ${previousMonthStats.label}`}
                    value={
                      changePct(stats.totalOrders, previousMonthStats.orders) == null
                        ? '—'
                        : `${changePct(stats.totalOrders, previousMonthStats.orders)!.toFixed(1)}%`
                    }
                  />
                  <MetricCard
                    title={`Avg Order vs ${previousMonthStats.label}`}
                    value={
                      changePct(
                        stats.avgOrderValue,
                        previousMonthStats.avgOrderValue,
                      ) == null
                        ? '—'
                        : `${changePct(stats.avgOrderValue, previousMonthStats.avgOrderValue)!.toFixed(1)}%`
                    }
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard title="Best Performing Product" value={ceoInsights.topProduct} />
                <MetricCard title="Top City" value={ceoInsights.topCity} />
                <MetricCard title="Biggest Revenue Day" value={ceoInsights.biggestRevenueDay} />
                <MetricCard
                  title="High Demand Products"
                  hint="Products with 10+ units sold (period)"
                  value={String(ceoInsights.highDemandProductCount)}
                />
                <MetricCard
                  title="Cancelled Order Impact"
                  value={money(ceoInsights.cancelledImpact)}
                />
              </div>
              <GlassBox title="CEO Summary">
                <div className="space-y-2 text-sm text-gray-200 sm:text-base">
                  <p>
                    Paid revenue is {ceoInsights.paidShare.toFixed(1)}% of gross order value;
                    delivered value is {ceoInsights.deliveredShare.toFixed(1)}%.
                  </p>
                  <p>Top product this period is {ceoInsights.topProduct}.</p>
                  <p>Most demand is size {ceoInsights.topSize} with strongest concentration in {ceoInsights.topCity}.</p>
                </div>
              </GlassBox>
            </div>
          ) : null}

          {activeSection === 'revenue' ? (
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  title="Discounts Given"
                  value={money(stats.totalDiscounts)}
                />
              </div>
              <LazySection
                minHeight={300}
                fallback={
                  <div className="grid gap-6 lg:grid-cols-2">
                    <SkeletonAnalyticsCard />
                    <SkeletonAnalyticsCard />
                  </div>
                }
              >
              <div className="grid gap-6 lg:grid-cols-2">
                <GlassBox title="Gross Order Value Trend">
                  <AnalyticsChartFrame>
                      <AreaChart data={stats.dailyRevenue}>
                        <defs>
                          <linearGradient id="purple" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ddd6fe" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.15} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="day"
                          stroke={CHART_AXIS.stroke}
                          tick={CHART_AXIS.tick}
                        />
                        <YAxis
                          stroke={CHART_AXIS.stroke}
                          tick={CHART_AXIS.tick}
                          width={45}
                        />
                        <Tooltip {...CHART_TOOLTIP_PROPS} />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#e9d5ff"
                          strokeWidth={2}
                          fill="url(#purple)"
                        />
                      </AreaChart>
                  </AnalyticsChartFrame>
                </GlassBox>

                <GlassBox title="Best Sellers">
                  <AnalyticsChartFrame>
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
                          fill="#c4b5fd"
                          radius={[10, 10, 0, 0]}
                        />
                      </BarChart>
                  </AnalyticsChartFrame>
                </GlassBox>
              </div>
              </LazySection>
            </div>
          ) : null}

          {activeSection === 'orders' ? (
            <div className="mt-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md">
                <MetricCard
                  title="Cancel Rate"
                  value={`${stats.cancelRate.toFixed(1)}%`}
                />
              </div>
              <LazySection
                minHeight={280}
                fallback={
                  <div className="grid gap-6 lg:grid-cols-2">
                    <SkeletonAnalyticsCard />
                    <SkeletonAnalyticsCard />
                  </div>
                }
              >
              <div className="grid gap-6 lg:grid-cols-2">
                <GlassBox title="Order Status">
                  <PieBlock data={stats.pieStatus} />
                </GlassBox>

                <GlassBox title="Payment Methods">
                  <PieBlock data={stats.piePayment} />
                </GlassBox>
              </div>
              </LazySection>
            </div>
          ) : null}

          {activeSection === 'products' ? (
            <LazySection
              className="mt-8"
              minHeight={320}
              fallback={
                <div className="mt-8 flex gap-4 overflow-hidden md:grid md:grid-cols-2 md:gap-6 2xl:grid-cols-3">
                  <SkeletonAnalyticsCard />
                  <SkeletonAnalyticsCard />
                  <SkeletonAnalyticsCard />
                </div>
              }
            >
              <div className="-mx-1 flex gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:pb-0 md:snap-none xl:gap-8 2xl:grid-cols-3">
                <GlassBox title="Best Sellers" className={PRODUCTS_CHART_CARD}>
                  <AnalyticsChartFrame scrollMinWidth={320}>
                    <BarChart
                      data={stats.bestSellers}
                      margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid {...CHART_GRID} />
                      <XAxis dataKey="name" {...CHART_AXIS_X_COMPACT} />
                      <YAxis
                        stroke={CHART_AXIS.stroke}
                        tick={CHART_AXIS.tick}
                        width={44}
                      />
                      <Tooltip {...CHART_TOOLTIP_PROPS} />
                      <Bar
                        dataKey="units"
                        fill="#c4b5fd"
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </AnalyticsChartFrame>
                </GlassBox>

                <GlassBox title="Size Demand" className={PRODUCTS_CHART_CARD}>
                  <AnalyticsChartFrame scrollMinWidth={300}>
                    <BarChart
                      data={stats.sizeDemand}
                      margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid {...CHART_GRID} />
                      <XAxis dataKey="name" {...CHART_AXIS_X_COMPACT} />
                      <YAxis
                        stroke={CHART_AXIS.stroke}
                        tick={CHART_AXIS.tick}
                        width={44}
                      />
                      <Tooltip {...CHART_TOOLTIP_PROPS} />
                      <Bar
                        dataKey="units"
                        fill="#f0abfc"
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </AnalyticsChartFrame>
                </GlassBox>

                <GlassBox title="Color Demand" className={PRODUCTS_CHART_CARD}>
                  <AnalyticsChartFrame scrollMinWidth={300}>
                    <BarChart
                      data={stats.colorDemand}
                      margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid {...CHART_GRID} />
                      <XAxis dataKey="name" {...CHART_AXIS_X_COMPACT} />
                      <YAxis
                        stroke={CHART_AXIS.stroke}
                        tick={CHART_AXIS.tick}
                        width={44}
                      />
                      <Tooltip {...CHART_TOOLTIP_PROPS} />
                      <Bar
                        dataKey="units"
                        fill="#d8b4fe"
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </AnalyticsChartFrame>
                </GlassBox>
              </div>
            </LazySection>
          ) : null}

          {activeSection === 'customers' ? (
            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <LazySection minHeight={280} fallback={<SkeletonAnalyticsCard />}>
              <GlassBox title="Top Cities">
                <AnalyticsChartFrame>
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
                        fill="#a78bfa"
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                </AnalyticsChartFrame>
              </GlassBox>
              </LazySection>

              <GlassBox title="VIP Customers">
                <div className="space-y-3">
                  {stats.topCustomers.map((customer, index) => (
                    <div
                      key={customer.email}
                      className="rounded-2xl border border-purple-950 bg-[#07030d] p-4"
                    >
                      <p className="text-sm text-purple-300">#{index + 1}</p>
                      <p className="font-bold text-white">{customer.name}</p>
                      <p className="break-all text-sm text-gray-400">{customer.email}</p>
                      <p className="mt-2 text-purple-200">
                        {money(customer.total)} · {customer.orders} orders
                      </p>
                    </div>
                  ))}
                </div>
              </GlassBox>
            </div>
          ) : null}

          {activeSection === 'event-qr' ? (
            <div className="mt-8 space-y-6">
              <p className="max-w-3xl text-xs text-gray-400 sm:text-sm">
                Booth / Event QR metrics.{' '}
                <span className="text-purple-200/90">
                  Redemptions are lifetime counts per campaign. Orders, revenue, and discount use the
                  selected period and exclude cancelled orders; only orders with{' '}
                  <code className="rounded bg-black/40 px-1 text-purple-200">discount_source=event</code>{' '}
                  are counted.
                </span>
              </p>

              {!stats.eventQr.hasCampaigns ? (
                <GlassBox title="Event QR">
                  <p className="text-center text-sm text-gray-400">
                    No booth campaigns yet. Create one under Admin → Event QR.
                  </p>
                </GlassBox>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-4">
                    <MetricCard
                      title="Campaigns (total)"
                      value={String(stats.eventQr.totalCampaigns)}
                    />
                    <MetricCard
                      title="Active campaigns"
                      value={String(stats.eventQr.activeCampaigns)}
                    />
                    <MetricCard
                      title="Lifetime redemptions"
                      value={String(stats.eventQr.totalRedemptionsLifetime)}
                    />
                    <MetricCard
                      title="Event orders (period)"
                      value={String(stats.eventQr.eventOrdersInPeriod)}
                      glow
                    />
                    <MetricCard
                      title="Event revenue (period)"
                      value={money(stats.eventQr.eventRevenueInPeriod)}
                    />
                    <MetricCard
                      title="Event discount given"
                      value={money(stats.eventQr.eventDiscountInPeriod)}
                    />
                    <MetricCard
                      title="Best campaign (orders)"
                      value={stats.eventQr.bestCampaignName}
                    />
                    <MetricCard
                      title="Best campaign revenue"
                      value={money(stats.eventQr.bestCampaignRevenue)}
                    />
                  </div>

                  <GlassBox title="Campaign performance">
                    <div className="-mx-1 overflow-x-auto rounded-2xl border border-purple-950/50 bg-[#05030a]/40 px-1 pb-1 pt-0.5 sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0">
                      <table className="w-full min-w-[720px] text-left text-xs text-gray-200 sm:text-sm">
                        <thead>
                          <tr className="border-b border-purple-950/80 text-[10px] font-bold uppercase tracking-wide text-purple-300">
                            <th className="whitespace-nowrap py-2 pr-3">Campaign</th>
                            <th className="whitespace-nowrap py-2 pr-3">Code</th>
                            <th className="whitespace-nowrap py-2 pr-3">%</th>
                            <th className="whitespace-nowrap py-2 pr-3">Status</th>
                            <th className="whitespace-nowrap py-2 pr-3 text-right">Redemptions</th>
                            <th className="whitespace-nowrap py-2 pr-3 text-right">Orders</th>
                            <th className="whitespace-nowrap py-2 pr-3 text-right">Revenue</th>
                            <th className="whitespace-nowrap py-2 pr-3 text-right">Discount</th>
                            <th className="whitespace-nowrap py-2 text-right">Conversion</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.eventQr.campaignRows.map((r) => (
                            <tr
                              key={`${r.code}-${r.name}`}
                              className="border-b border-purple-950/40 odd:bg-[#05030a]/80"
                            >
                              <td className="max-w-[140px] truncate py-2 pr-3 font-semibold text-white">
                                {r.name}
                              </td>
                              <td className="whitespace-nowrap py-2 pr-3 font-mono text-purple-200">
                                {r.code}
                              </td>
                              <td className="py-2 pr-3">{r.discountPercent}%</td>
                              <td className="py-2 pr-3">{r.activeLabel}</td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {r.redemptionsLifetime}
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {r.usedOrdersPeriod}
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {money(r.revenuePeriod)}
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums">
                                {money(r.discountGivenPeriod)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-purple-100">
                                {r.conversionPct.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GlassBox>

                  <div className="grid gap-6 lg:grid-cols-2">
                    <GlassBox title="Revenue by campaign (period)">
                      <div data-export-chart="event-qr-revenue">
                        <AnalyticsChartFrame>
                          <BarChart data={stats.eventQr.chartRevenueByCampaign}>
                              <CartesianGrid {...CHART_GRID} />
                              <XAxis
                                dataKey="name"
                                stroke={CHART_AXIS.stroke}
                                tick={{ ...CHART_AXIS.tick, fontSize: 10 }}
                                interval={0}
                                angle={-14}
                                textAnchor="end"
                                height={72}
                              />
                              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} width={48} />
                              <Tooltip {...CHART_TOOLTIP_PROPS} formatter={(v) => money(Number(v))} />
                              <Bar
                                dataKey="revenue"
                                fill="#c4b5fd"
                                radius={[10, 10, 0, 0]}
                              />
                            </BarChart>
                        </AnalyticsChartFrame>
                      </div>
                    </GlassBox>

                    <GlassBox title="Redemptions by campaign (lifetime)">
                      <div data-export-chart="event-qr-redemptions">
                        <AnalyticsChartFrame>
                          <BarChart data={stats.eventQr.chartRedemptionsByCampaign}>
                              <CartesianGrid {...CHART_GRID} />
                              <XAxis
                                dataKey="name"
                                stroke={CHART_AXIS.stroke}
                                tick={{ ...CHART_AXIS.tick, fontSize: 10 }}
                                interval={0}
                                angle={-14}
                                textAnchor="end"
                                height={72}
                              />
                              <YAxis stroke={CHART_AXIS.stroke} tick={CHART_AXIS.tick} width={44} />
                              <Tooltip {...CHART_TOOLTIP_PROPS} />
                              <Bar
                                dataKey="redemptions"
                                fill="#f0abfc"
                                radius={[10, 10, 0, 0]}
                              />
                            </BarChart>
                        </AnalyticsChartFrame>
                      </div>
                    </GlassBox>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {activeSection === 'wishlist' ? (
            <div className="mt-8">
              <AdminWishlistAnalyticsPanel />
            </div>
          ) : null}

          {activeSection === 'abandoned' ? (
            <div className="mt-8 max-w-3xl">
              <GlassBox title="Abandoned Cart Recovery">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Mini title="Total tracked carts" value={stats.cartsTotal} />
                  <Mini title="Recovered after reminders" value={stats.cartsRecovered} />
                  <Mini title="Expired carts" value={stats.cartsExpired} />
                  <Mini title="Email reminders sent" value={stats.emailReminders} />
                  <Mini title="WhatsApp reminders sent" value={stats.whatsappReminders} />
                </div>
              </GlassBox>
            </div>
          ) : null}
        </section>
      </main>
    </AdminOnly>
  );
}

function GlassBox({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-purple-950 bg-[#0d0716] p-4 shadow-[0_18px_60px_rgba(168,85,247,0.12)] sm:p-6 ${className}`}
    >
      <p className="mb-5 text-xs uppercase tracking-[0.25em] text-purple-100 sm:mb-6 sm:text-sm sm:tracking-[0.3em]">
        {title}
      </p>
      {children}
    </div>
  );
}


function Mini({ title, value }: { title: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-purple-950 bg-[#07030d] p-4">
      <span className="text-sm text-gray-300 sm:text-base">{title}</span>
      <span className="text-2xl font-black tabular-nums text-white drop-shadow-[0_0_10px_rgba(216,180,254,0.3)]">
        {value}
      </span>
    </div>
  );
}

function PieBlock({ data }: { data: { name: string; value: number }[] }) {
  return (
    <AnalyticsChartFrame>
      <PieChart>
        <Pie data={data} dataKey="value" outerRadius={85} label>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="#1a1028" strokeWidth={1} />
          ))}
        </Pie>
        <Tooltip {...CHART_TOOLTIP_PROPS} />
      </PieChart>
    </AnalyticsChartFrame>
  );
}
