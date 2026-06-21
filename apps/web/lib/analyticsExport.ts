import { jsPDF } from 'jspdf';
import { csvLine } from '@/lib/csvExport';
import {
  getAdminOrderTotal,
  type AdminOrderRow,
} from '@/lib/adminOrderMetrics';

// TODO: Multi-sheet XLSX (e.g. SheetJS) could add per-section tabs and chart images; not implemented here — CSV stays the portable export.

export type EventQrCampaignStatRow = {
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

export type AnalyticsEventQrRow = {
  name: string;
  code: string;
  discountPercent: number;
  activeLabel: string;
  redemptionsLifetime: number;
  usedOrdersPeriod: number;
  revenuePeriod: number;
  discountGivenPeriod: number;
  conversionPct: number;
};

export type AnalyticsEventQrBlock = {
  hasCampaigns: boolean;
  totalCampaigns: number;
  activeCampaigns: number;
  totalRedemptionsLifetime: number;
  eventOrdersInPeriod: number;
  eventRevenueInPeriod: number;
  eventDiscountInPeriod: number;
  bestCampaignName: string;
  bestCampaignOrders: number;
  bestCampaignRevenue: number;
  campaignRows: AnalyticsEventQrRow[];
  chartRevenueByCampaign: { name: string; revenue: number }[];
  chartRedemptionsByCampaign: { name: string; redemptions: number }[];
};

type OrderLikeForEventQr = {
  status: string;
  discount_source?: string | null;
  event_campaign_id?: string | null;
  total?: number | null;
  discount_amount?: number | null;
};

function shortCampaignLabel(name: string, max = 18) {
  const t = String(name || '').trim();
  if (t.length <= max) return t || '—';
  return `${t.slice(0, max - 1)}…`;
}

/** Booth / Event QR aggregates — orders use same non-cancelled rule as main analytics. */
export function buildAnalyticsEventQrBlock(
  activeNonCancelledOrders: OrderLikeForEventQr[],
  campaigns: EventQrCampaignStatRow[] | null | undefined,
): AnalyticsEventQrBlock {
  const list = Array.isArray(campaigns) ? campaigns : [];
  const hasCampaigns = list.length > 0;

  const eventOrders = activeNonCancelledOrders.filter(
    (o) => String(o.discount_source || '').toLowerCase() === 'event',
  );

  const eventRevenueInPeriod = eventOrders.reduce(
    (s, o) => s + getAdminOrderTotal(o as AdminOrderRow),
    0,
  );
  const eventDiscountInPeriod = eventOrders.reduce(
    (s, o) => s + Number(o.discount_amount || 0),
    0,
  );

  const byCampaign = new Map<
    string,
    { orders: number; revenue: number; discount: number }
  >();
  for (const o of eventOrders) {
    const id = String(o.event_campaign_id || '').trim();
    if (!id) continue;
    const cur = byCampaign.get(id) ?? { orders: 0, revenue: 0, discount: 0 };
    cur.orders += 1;
    cur.revenue += getAdminOrderTotal(o as AdminOrderRow);
    cur.discount += Number(o.discount_amount || 0);
    byCampaign.set(id, cur);
  }

  let bestName = '—';
  let bestOrders = 0;
  let bestRevenue = 0;
  for (const c of list) {
    const p = byCampaign.get(c.id);
    if (!p) continue;
    if (p.orders > bestOrders || (p.orders === bestOrders && p.revenue > bestRevenue)) {
      bestName = c.name || c.code || '—';
      bestOrders = p.orders;
      bestRevenue = p.revenue;
    }
  }

  const totalRedemptionsLifetime = list.reduce(
    (s, c) => s + Number(c.redemption_count || 0),
    0,
  );
  const activeCampaigns = list.filter((c) => Boolean(c.active)).length;

  const campaignRows: AnalyticsEventQrRow[] = list.map((c) => {
    const p = byCampaign.get(c.id);
    const usedOrdersPeriod = p?.orders ?? 0;
    const revenuePeriod = p?.revenue ?? 0;
    const discountGivenPeriod = p?.discount ?? 0;
    const red = Math.max(0, Number(c.redemption_count || 0));
    const conversionPct = red > 0 ? (usedOrdersPeriod / red) * 100 : 0;
    return {
      name: c.name || '—',
      code: c.code || '—',
      discountPercent: Number(c.discount_percent || 0),
      activeLabel: c.active ? 'Active' : 'Inactive',
      redemptionsLifetime: red,
      usedOrdersPeriod,
      revenuePeriod,
      discountGivenPeriod,
      conversionPct,
    };
  });

  const chartRevenueByCampaign = list
    .map((c) => ({
      name: shortCampaignLabel(c.name || c.code),
      revenue: byCampaign.get(c.id)?.revenue ?? 0,
    }))
    .filter((r) => r.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 12);

  const chartRedemptionsByCampaign = list
    .map((c) => ({
      name: shortCampaignLabel(c.name || c.code),
      redemptions: Number(c.redemption_count || 0),
    }))
    .filter((r) => r.redemptions > 0)
    .sort((a, b) => b.redemptions - a.redemptions)
    .slice(0, 12);

  return {
    hasCampaigns,
    totalCampaigns: list.length,
    activeCampaigns,
    totalRedemptionsLifetime,
    eventOrdersInPeriod: eventOrders.length,
    eventRevenueInPeriod,
    eventDiscountInPeriod,
    bestCampaignName: bestName,
    bestCampaignOrders: bestOrders,
    bestCampaignRevenue: bestRevenue,
    campaignRows,
    chartRevenueByCampaign:
      chartRevenueByCampaign.length > 0
        ? chartRevenueByCampaign
        : [{ name: '—', revenue: 0 }],
    chartRedemptionsByCampaign:
      chartRedemptionsByCampaign.length > 0
        ? chartRedemptionsByCampaign
        : [{ name: '—', redemptions: 0 }],
  };
}

/** Read-only snapshot of dashboard aggregates — must match analytics page `stats` useMemo. */
export type AnalyticsExportStats = {
  grossOrderValue: number;
  paidRevenue: number;
  deliveredRevenue: number;
  pendingOrderValue: number;
  codOutstandingCount: number;
  codOutstandingValue: number;
  failedExpiredPaymentsCount: number;
  failedPaymentsCount: number;
  expiredPaymentsCount: number;
  failedExpiredPaymentsValue: number;
  nonCancelledOrderCount: number;
  avgOrderValue: number;
  totalOrders: number;
  cancelRate: number;
  totalDiscounts: number;
  highDemandProductCount: number;
  couponUsageRate: number;
  cartsTotal: number;
  cartsRecovered: number;
  cartsExpired: number;
  emailReminders: number;
  whatsappReminders: number;
  dailyRevenue: { day: string; revenue: number }[];
  cities: { name: string; orders: number }[];
  pieStatus: { name: string; value: number }[];
  piePayment: { name: string; value: number }[];
  bestSellers: { name: string; units: number }[];
  sizeDemand: { name: string; units: number }[];
  colorDemand: { name: string; units: number }[];
  topCustomers: { name: string; email: string; total: number; orders: number }[];
  eventQr: AnalyticsEventQrBlock;
};

export type AnalyticsChartCaptureId =
  | 'revenue-trend'
  | 'best-sellers'
  | 'order-status'
  | 'payment-methods'
  | 'size-demand'
  | 'color-demand'
  | 'top-cities'
  | 'event-qr-revenue'
  | 'event-qr-redemptions';

export const ANALYTICS_CHART_CAPTURE_IDS: readonly AnalyticsChartCaptureId[] = [
  'revenue-trend',
  'best-sellers',
  'order-status',
  'payment-methods',
  'size-demand',
  'color-demand',
  'top-cities',
  'event-qr-revenue',
  'event-qr-redemptions',
] as const;

export function formatCurrency(value: number): string {
  return `EGP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${Number(value || 0).toFixed(fractionDigits)}%`;
}

export type BuildAnalyticsCsvOptions = {
  periodLabel?: string;
};

/** Excel-friendly CSV: UTF-8 BOM, clear section blocks, quoted cells when needed, no JSON. */
export function buildAnalyticsCsv(
  stats: AnalyticsExportStats,
  opts?: BuildAnalyticsCsvOptions,
): string {
  const lines: string[] = [];
  const period = opts?.periodLabel ?? 'All time';
  const generated = new Date().toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const section = (heading: string, subtitle?: string) => {
    lines.push('');
    lines.push(csvLine([`— ${heading} —`]));
    if (subtitle) lines.push(csvLine([subtitle]));
  };

  lines.push(csvLine(["Bunny's Whisper — Analytics Report"]));
  lines.push(csvLine(['Report type', 'Analytics (tabular summary only; charts are not included in CSV)']));
  lines.push(csvLine(['Generated', generated]));
  lines.push(csvLine(['Selected period', period]));
  lines.push(
    csvLine([
      'Scope note',
      'Order-based sections use the selected period. Abandoned-cart recovery metrics reflect all-time data loaded in the dashboard.',
    ]),
  );

  section('Summary Metrics', 'Currency in EGP unless noted. Percentages use a decimal point.');
  lines.push(csvLine(['Metric', 'Value']));
  lines.push(
    csvLine([
      'Gross order value (EGP)',
      formatCurrency(stats.grossOrderValue),
    ]),
  );
  lines.push(csvLine(['Paid revenue (EGP)', formatCurrency(stats.paidRevenue)]));
  lines.push(
    csvLine([
      'Delivered order value (EGP)',
      formatCurrency(stats.deliveredRevenue),
    ]),
  );
  lines.push(
    csvLine([
      'Pending order value (EGP)',
      formatCurrency(stats.pendingOrderValue),
    ]),
  );
  lines.push(
    csvLine(['COD outstanding (count)', stats.codOutstandingCount]),
  );
  lines.push(
    csvLine([
      'COD outstanding value (EGP)',
      formatCurrency(stats.codOutstandingValue),
    ]),
  );
  lines.push(
    csvLine([
      'Failed/expired payments (total count)',
      stats.failedExpiredPaymentsCount,
    ]),
  );
  lines.push(
    csvLine(['Expired payments (count)', stats.expiredPaymentsCount]),
  );
  lines.push(csvLine(['Failed payments (count)', stats.failedPaymentsCount]));
  lines.push(
    csvLine([
      'Failed/expired order value (EGP)',
      formatCurrency(stats.failedExpiredPaymentsValue),
    ]),
  );
  lines.push(
    csvLine(['Non-cancelled orders (count)', stats.nonCancelledOrderCount]),
  );
  lines.push(csvLine(['Total orders in period (count)', stats.totalOrders]));
  lines.push(
    csvLine([
      'Average order value — gross (EGP)',
      formatCurrency(stats.avgOrderValue),
    ]),
  );
  lines.push(csvLine(['Discounts total (EGP)', formatCurrency(stats.totalDiscounts)]));
  lines.push(csvLine(['Cancel rate (percent)', formatPercent(stats.cancelRate)]));
  lines.push(csvLine(['Coupon usage rate (percent)', formatPercent(stats.couponUsageRate)]));

  section(
    'Gross Order Value Trend',
    'Daily gross (non-cancelled) totals in EGP for the selected period',
  );
  lines.push(csvLine(['Date', 'Gross order value (EGP)']));
  stats.dailyRevenue.forEach((r) =>
    lines.push(csvLine([r.day, formatCurrency(r.revenue)])),
  );

  section('Best Sellers', 'Units sold in period');
  lines.push(csvLine(['Product name', 'Units sold']));
  stats.bestSellers.forEach((r) => lines.push(csvLine([r.name, r.units])));

  section('Order Status', 'Order counts by status');
  lines.push(csvLine(['Status label', 'Order count']));
  stats.pieStatus.forEach((r) => lines.push(csvLine([r.name, r.value])));

  section('Payment Methods', 'Order counts by payment method');
  lines.push(csvLine(['Payment method', 'Order count']));
  stats.piePayment.forEach((r) => lines.push(csvLine([r.name, r.value])));

  section('Size Demand', 'Units sold by size');
  lines.push(csvLine(['Size', 'Units sold']));
  stats.sizeDemand.forEach((r) => lines.push(csvLine([r.name, r.units])));

  section('Color Demand', 'Units sold by color');
  lines.push(csvLine(['Color', 'Units sold']));
  stats.colorDemand.forEach((r) => lines.push(csvLine([r.name, r.units])));

  section('Top Cities', 'Orders by city');
  lines.push(csvLine(['City', 'Order count']));
  stats.cities.forEach((r) => lines.push(csvLine([r.name, r.orders])));

  section('VIP Customers', 'Top customers by spend in period');
  lines.push(csvLine(['Rank', 'Customer name', 'Email', 'Total spend (EGP)', 'Order count']));
  stats.topCustomers.forEach((r, i) =>
    lines.push(
      csvLine([
        i + 1,
        r.name,
        r.email,
        formatCurrency(r.total),
        r.orders,
      ]),
    ),
  );

  section(
    'Event QR (Booth)',
    'Redemptions = lifetime rows per campaign. Orders, revenue, and discount = selected period, non-cancelled orders with discount_source=event. Conversion = period orders ÷ lifetime redemptions.',
  );
  const eq = stats.eventQr;
  lines.push(csvLine(['Metric', 'Value']));
  lines.push(csvLine(['Total campaigns', eq.totalCampaigns]));
  lines.push(csvLine(['Active campaigns', eq.activeCampaigns]));
  lines.push(csvLine(['Total redemptions (lifetime)', eq.totalRedemptionsLifetime]));
  lines.push(csvLine(['Event QR orders (period)', eq.eventOrdersInPeriod]));
  lines.push(csvLine(['Event QR revenue (period, EGP)', formatCurrency(eq.eventRevenueInPeriod)]));
  lines.push(csvLine(['Event QR discount given (period, EGP)', formatCurrency(eq.eventDiscountInPeriod)]));
  lines.push(csvLine(['Best campaign (by orders)', eq.bestCampaignName]));
  lines.push(csvLine(['Best campaign orders (period)', eq.bestCampaignOrders]));
  lines.push(csvLine(['Best campaign revenue (period, EGP)', formatCurrency(eq.bestCampaignRevenue)]));
  lines.push(
    csvLine([
      'Campaign',
      'Code',
      'Discount %',
      'Active',
      'Redemptions LT',
      'Orders period',
      'Revenue period',
      'Discount period',
      'Conversion %',
    ]),
  );
  if (eq.campaignRows.length === 0) {
    lines.push(csvLine(['No booth campaigns', '—', '', '', '', '', '', '', '']));
  } else {
    eq.campaignRows.forEach((r) =>
      lines.push(
        csvLine([
          r.name,
          r.code,
          r.discountPercent,
          r.activeLabel,
          r.redemptionsLifetime,
          r.usedOrdersPeriod,
          formatCurrency(r.revenuePeriod),
          formatCurrency(r.discountGivenPeriod),
          formatPercent(r.conversionPct),
        ]),
      ),
    );
  }
  lines.push(csvLine(['Chart data — revenue by campaign (period, EGP)']));
  lines.push(csvLine(['Campaign (short)', 'Revenue']));
  stats.eventQr.chartRevenueByCampaign.forEach((r) =>
    lines.push(csvLine([r.name, formatCurrency(r.revenue)])),
  );
  lines.push(csvLine(['Chart data — redemptions by campaign (lifetime count)']));
  lines.push(csvLine(['Campaign (short)', 'Redemptions']));
  stats.eventQr.chartRedemptionsByCampaign.forEach((r) =>
    lines.push(csvLine([r.name, r.redemptions])),
  );

  section('Abandoned Cart Recovery', 'All-time recovery snapshot from dashboard data');
  lines.push(csvLine(['Metric', 'Value']));
  lines.push(csvLine(['Total tracked carts', stats.cartsTotal]));
  lines.push(csvLine(['Recovered after reminders', stats.cartsRecovered]));
  lines.push(csvLine(['Expired carts', stats.cartsExpired]));
  lines.push(csvLine(['Email reminders sent', stats.emailReminders]));
  lines.push(csvLine(['WhatsApp reminders sent', stats.whatsappReminders]));

  return '\uFEFF' + lines.join('\n');
}

export function triggerAnalyticsCsvDownload(
  stats: AnalyticsExportStats,
  opts?: BuildAnalyticsCsvOptions,
) {
  const csv = buildAnalyticsCsv(stats, opts);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = (opts?.periodLabel ?? 'all-time')
    .replace(/[^\w]+/g, '-')
    .toLowerCase()
    .slice(0, 40);
  a.download = `bunnys-whisper-analytics-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function captureAnalyticsChartImages(
  root: HTMLElement | null,
): Promise<{
  images: Partial<Record<AnalyticsChartCaptureId, string>>;
  errors: Partial<Record<AnalyticsChartCaptureId, string>>;
}> {
  if (typeof window === 'undefined') return { images: {}, errors: {} };
  const nextFrame = () =>
    new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  await new Promise((resolve) => window.setTimeout(resolve, 1000));
  await nextFrame();
  await nextFrame();
  let html2canvas: (typeof import('html2canvas'))['default'];
  try {
    html2canvas = (await import('html2canvas')).default;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown_import_error';
    console.warn('[analytics-export] html2canvas import failed');
    const allErrors = Object.fromEntries(
      ANALYTICS_CHART_CAPTURE_IDS.map((id) => [id, `html2canvas import error: ${msg}`]),
    ) as Partial<Record<AnalyticsChartCaptureId, string>>;
    return { images: {}, errors: allErrors };
  }
  const out: Partial<Record<AnalyticsChartCaptureId, string>> = {};
  const errors: Partial<Record<AnalyticsChartCaptureId, string>> = {};
  for (const id of ANALYTICS_CHART_CAPTURE_IDS) {
    const selector = `[data-export-chart="${id}"]`;
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) {
      errors[id] = 'Missing export chart element';
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      errors[id] = 'Chart has zero width/height';
      continue;
    }
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0b0612',
        logging: false,
      });
      out[id] = canvas.toDataURL('image/png');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'unknown_error';
      errors[id] = `html2canvas error: ${msg}`;
      console.warn(`[analytics-export] capture failed for ${id}`);
    }
  }
  return { images: out, errors };
}

const PDF_M = 44;
const PDF_LINE = 11.5;
const PDF_BOTTOM = 36;

function pageSize(doc: jsPDF) {
  return {
    w: doc.internal.pageSize.getWidth(),
    h: doc.internal.pageSize.getHeight(),
  };
}

function ensureSpace(doc: jsPDF, y: number, need: number): number {
  const { h } = pageSize(doc);
  if (y + need > h - PDF_BOTTOM) {
    doc.addPage();
    return PDF_M;
  }
  return y;
}

function drawDivider(doc: jsPDF, y: number): number {
  const { w } = pageSize(doc);
  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.35);
  doc.line(PDF_M, y, w - PDF_M, y);
  return y + 14;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  y = ensureSpace(doc, y, PDF_LINE + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(60, 20, 90);
  doc.text(title, PDF_M, y);
  doc.setTextColor(0, 0, 0);
  return y + PDF_LINE + 4;
}

function addRasterImage(
  doc: jsPDF,
  y: number,
  contentW: number,
  dataUrl: string,
): number {
  const props = doc.getImageProperties(dataUrl);
  const imgW = contentW;
  const imgH = (props.height * imgW) / props.width;
  y = ensureSpace(doc, y, imgH + 10);
  doc.addImage(dataUrl, 'PNG', PDF_M, y + 2, imgW, imgH, undefined, 'FAST');
  return y + imgH + 14;
}

export type GenerateAnalyticsPdfOptions = {
  periodLabel?: string;
  images?: Partial<Record<AnalyticsChartCaptureId, string>>;
  insights?: string[];
};

/** PDF with optional chart snapshots (same data as dashboard); tables fill gaps if capture fails. */
export function generateAnalyticsPdf(
  stats: AnalyticsExportStats,
  options?: GenerateAnalyticsPdfOptions,
): void {
  const images = options?.images ?? {};
  const periodLabel = options?.periodLabel ?? 'All time';
  const failedPaymentsRate = stats.totalOrders
    ? (stats.failedExpiredPaymentsCount / stats.totalOrders) * 100
    : 0;
  const computedInsights: string[] = [
    `Top product this period: ${stats.bestSellers[0]?.name || '—'}.`,
    `Most requested size: ${stats.sizeDemand[0]?.name || '—'}.`,
    `Highest demand city: ${stats.cities[0]?.name || '—'}.`,
    `Failed/expired: ${stats.failedExpiredPaymentsCount} total (${stats.expiredPaymentsCount} expired, ${stats.failedPaymentsCount} failed) — ${formatCurrency(stats.failedExpiredPaymentsValue)} (${formatPercent(failedPaymentsRate)} of period orders).`,
  ];
  if (stats.eventQr.eventOrdersInPeriod > 0) {
    computedInsights.push(
      `Event QR booth: ${stats.eventQr.eventOrdersInPeriod} orders, ${formatCurrency(stats.eventQr.eventRevenueInPeriod)} revenue; strongest campaign: ${stats.eventQr.bestCampaignName} (${stats.eventQr.bestCampaignOrders} orders).`,
    );
  } else if (stats.eventQr.hasCampaigns) {
    computedInsights.push(
      'Event QR: booth campaigns exist; no booth-tagged orders in this period yet.',
    );
  }
  const insights = (options?.insights && options.insights.length > 0
    ? options.insights
    : computedInsights
  ).filter(Boolean);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const { w, h } = pageSize(doc);
  const contentW = w - PDF_M * 2;
  let y = PDF_M;
  const colLabel = PDF_M;
  const colVal = PDF_M + contentW * 0.52;

  const brandBar = () => {
    doc.setFillColor(76, 29, 120);
    doc.rect(0, 0, w, 6, 'F');
    doc.setFillColor(243, 232, 255);
    doc.rect(0, 6, w, 52, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(45, 15, 70);
    doc.text("Bunny's Whisper", PDF_M, 38);
    doc.setFontSize(11);
    doc.setTextColor(90, 70, 110);
    doc.text('Analytics Report', PDF_M, 52);
    doc.setTextColor(0, 0, 0);
    y = 72;
  };

  brandBar();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y = ensureSpace(doc, y, PDF_LINE);
  doc.setTextColor(80, 80, 90);
  doc.text(`Period: ${periodLabel}`, PDF_M, y);
  y += PDF_LINE;
  doc.text(`Generated: ${new Date().toLocaleString()}`, PDF_M, y);
  doc.setTextColor(0, 0, 0);
  y += PDF_LINE + 10;
  y = drawDivider(doc, y);

  y = drawSectionTitle(doc, y, 'Summary metrics');
  const summaryRows: [string, string][] = [
    ['Gross order value', formatCurrency(stats.grossOrderValue)],
    ['Paid revenue', formatCurrency(stats.paidRevenue)],
    ['Delivered order value', formatCurrency(stats.deliveredRevenue)],
    ['Pending order value', formatCurrency(stats.pendingOrderValue)],
    ['COD outstanding', `${stats.codOutstandingCount} · ${formatCurrency(stats.codOutstandingValue)}`],
    [
      'Failed/expired payments',
      `${stats.failedExpiredPaymentsCount} total (${stats.expiredPaymentsCount} expired, ${stats.failedPaymentsCount} failed)`,
    ],
    ['Failed/expired value', formatCurrency(stats.failedExpiredPaymentsValue)],
    ['Non-cancelled orders', String(stats.nonCancelledOrderCount)],
    ['Total orders in period', String(stats.totalOrders)],
    ['Average order value (gross)', formatCurrency(stats.avgOrderValue)],
    ['Discounts total', formatCurrency(stats.totalDiscounts)],
    ['Cancel rate', formatPercent(stats.cancelRate)],
    ['Coupon usage', formatPercent(stats.couponUsageRate)],
  ];
  summaryRows.forEach(([label, val]) => {
    y = ensureSpace(doc, y, PDF_LINE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, colLabel, y);
    doc.setFont('helvetica', 'bold');
    doc.text(val, colVal, y);
    y += PDF_LINE;
  });
  y += 6;
  y = drawDivider(doc, y);

  y = drawSectionTitle(doc, y, 'Insights');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  insights.forEach((insight) => {
    const text = `• ${insight}`;
    const lines = doc.splitTextToSize(text, contentW - 4);
    lines.forEach((ln: string) => {
      y = ensureSpace(doc, y, PDF_LINE);
      doc.text(ln, PDF_M + 2, y);
      y += PDF_LINE;
    });
    y += 1;
  });
  y += 6;
  y = drawDivider(doc, y);

  y = drawSectionTitle(doc, y, 'Abandoned cart recovery');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const cartRows: [string, string][] = [
    ['Total tracked carts', String(stats.cartsTotal)],
    ['Recovered after reminders', String(stats.cartsRecovered)],
    ['Expired carts', String(stats.cartsExpired)],
    ['Email reminders sent', String(stats.emailReminders)],
    ['WhatsApp reminders sent', String(stats.whatsappReminders)],
  ];
  cartRows.forEach(([label, val]) => {
    y = ensureSpace(doc, y, PDF_LINE);
    doc.text(label, colLabel, y);
    doc.setFont('helvetica', 'bold');
    doc.text(val, colVal, y);
    doc.setFont('helvetica', 'normal');
    y += PDF_LINE;
  });
  y += 8;
  y = drawDivider(doc, y);

  const drawKeyValueTable = (title: string, rows: { key: string; val: string }[]) => {
    y = drawSectionTitle(doc, y, title);
    doc.setFontSize(8.5);
    doc.setFillColor(248, 246, 252);
    const rowH = PDF_LINE + 2;
    y = ensureSpace(doc, y, rowH + 4);
    doc.rect(PDF_M, y - 9, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Item', PDF_M + 4, y);
    doc.text('Value', colVal, y);
    y += rowH + 2;
    doc.setFont('helvetica', 'normal');
    rows.forEach((r) => {
      y = ensureSpace(doc, y, rowH);
      doc.text(r.key, PDF_M + 4, y);
      doc.setFont('helvetica', 'bold');
      doc.text(r.val, colVal, y);
      doc.setFont('helvetica', 'normal');
      y += rowH;
    });
    y += 8;
    y = drawDivider(doc, y);
  };

  const drawTwoColTable = (
    title: string,
    h1: string,
    h2: string,
    data: { a: string; b: string }[],
  ) => {
    y = drawSectionTitle(doc, y, title);
    const x2 = PDF_M + contentW * 0.62;
    const rowH = PDF_LINE + 3;
    y = ensureSpace(doc, y, rowH + 4);
    doc.setFillColor(237, 233, 254);
    doc.rect(PDF_M, y - 9, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(h1, PDF_M + 4, y);
    doc.text(h2, x2, y);
    y += rowH + 2;
    doc.setFont('helvetica', 'normal');
    data.forEach((row) => {
      y = ensureSpace(doc, y, rowH);
      const linesA = doc.splitTextToSize(row.a, x2 - PDF_M - 12);
      const linesB = doc.splitTextToSize(row.b, w - x2 - PDF_M);
      const h = Math.max(linesA.length, linesB.length) * PDF_LINE;
      y = ensureSpace(doc, y, h);
      let yy = y;
      linesA.forEach((ln: string) => {
        doc.text(ln, PDF_M + 4, yy);
        yy += PDF_LINE;
      });
      yy = y;
      linesB.forEach((ln: string) => {
        doc.text(ln, x2, yy);
        yy += PDF_LINE;
      });
      y += Math.max(linesA.length, linesB.length) * PDF_LINE + 2;
    });
    y += 6;
    y = drawDivider(doc, y);
  };

  if (images['revenue-trend']) {
    y = drawSectionTitle(doc, y, 'Revenue trend (chart)');
    y = addRasterImage(doc, y, contentW, images['revenue-trend']);
    y = drawDivider(doc, y);
  }

  drawTwoColTable(
    'Daily gross order value (values)',
    'Day',
    'Revenue',
    stats.dailyRevenue.map((r) => ({
      a: r.day,
      b: formatCurrency(r.revenue),
    })),
  );

  if (images['order-status']) {
    y = drawSectionTitle(doc, y, 'Order status (chart)');
    y = addRasterImage(doc, y, contentW, images['order-status']);
    y = drawDivider(doc, y);
  } else {
    drawKeyValueTable(
      'Order status',
      stats.pieStatus.map((r) => ({ key: r.name, val: String(r.value) })),
    );
  }

  if (images['payment-methods']) {
    y = drawSectionTitle(doc, y, 'Payment methods (chart)');
    y = addRasterImage(doc, y, contentW, images['payment-methods']);
    y = drawDivider(doc, y);
  } else {
    drawKeyValueTable(
      'Payment methods',
      stats.piePayment.map((r) => ({ key: r.name, val: String(r.value) })),
    );
  }

  if (images['best-sellers']) {
    y = drawSectionTitle(doc, y, 'Best sellers (chart)');
    y = addRasterImage(doc, y, contentW, images['best-sellers']);
    y = drawDivider(doc, y);
  }
  drawTwoColTable(
    'Best sellers (data)',
    'Product',
    'Units',
    stats.bestSellers.map((r) => ({ a: r.name, b: String(r.units) })),
  );

  if (images['size-demand']) {
    y = drawSectionTitle(doc, y, 'Size demand (chart)');
    y = addRasterImage(doc, y, contentW, images['size-demand']);
    y = drawDivider(doc, y);
  }
  drawTwoColTable(
    'Size demand (data)',
    'Size',
    'Units',
    stats.sizeDemand.map((r) => ({ a: r.name, b: String(r.units) })),
  );

  if (images['color-demand']) {
    y = drawSectionTitle(doc, y, 'Color demand (chart)');
    y = addRasterImage(doc, y, contentW, images['color-demand']);
    y = drawDivider(doc, y);
  }
  drawTwoColTable(
    'Color demand (data)',
    'Color',
    'Units',
    stats.colorDemand.map((r) => ({ a: r.name, b: String(r.units) })),
  );

  if (images['top-cities']) {
    y = drawSectionTitle(doc, y, 'Top cities (chart)');
    y = addRasterImage(doc, y, contentW, images['top-cities']);
    y = drawDivider(doc, y);
  }
  drawTwoColTable(
    'Top cities (data)',
    'City',
    'Orders',
    stats.cities.map((r) => ({ a: r.name, b: String(r.orders) })),
  );

  if (images['event-qr-revenue']) {
    y = drawSectionTitle(doc, y, 'Event QR — revenue by campaign (chart)');
    y = addRasterImage(doc, y, contentW, images['event-qr-revenue']);
    y = drawDivider(doc, y);
  }
  if (images['event-qr-redemptions']) {
    y = drawSectionTitle(doc, y, 'Event QR — redemptions by campaign (chart)');
    y = addRasterImage(doc, y, contentW, images['event-qr-redemptions']);
    y = drawDivider(doc, y);
  }

  const eqPdf = stats.eventQr;
  drawKeyValueTable('Event QR (booth) summary', [
    { key: 'Total campaigns', val: String(eqPdf.totalCampaigns) },
    { key: 'Active campaigns', val: String(eqPdf.activeCampaigns) },
    { key: 'Lifetime redemptions', val: String(eqPdf.totalRedemptionsLifetime) },
    { key: 'Event orders (period)', val: String(eqPdf.eventOrdersInPeriod) },
    { key: 'Event revenue (period)', val: formatCurrency(eqPdf.eventRevenueInPeriod) },
    { key: 'Event discount given (period)', val: formatCurrency(eqPdf.eventDiscountInPeriod) },
    {
      key: 'Best campaign',
      val: `${eqPdf.bestCampaignName} · ${eqPdf.bestCampaignOrders} orders · ${formatCurrency(eqPdf.bestCampaignRevenue)}`,
    },
  ]);
  drawTwoColTable(
    'Event QR campaigns (detail)',
    'Campaign',
    'Code · % · status · redemptions LT · orders · revenue · discount · conversion',
    eqPdf.campaignRows.length === 0
      ? [{ a: 'No booth campaigns', b: '—' }]
      : eqPdf.campaignRows.map((r) => ({
          a: r.name,
          b: `${r.code} · ${r.discountPercent}% · ${r.activeLabel} · redemptions ${r.redemptionsLifetime} · orders ${r.usedOrdersPeriod} · ${formatCurrency(r.revenuePeriod)} · disc ${formatCurrency(r.discountGivenPeriod)} · ${formatPercent(r.conversionPct)}`,
        })),
  );
  drawTwoColTable(
    'Event QR — revenue by campaign (values)',
    'Campaign',
    'Revenue (period)',
    stats.eventQr.chartRevenueByCampaign.map((r) => ({
      a: r.name,
      b: formatCurrency(r.revenue),
    })),
  );
  drawTwoColTable(
    'Event QR — redemptions by campaign (values)',
    'Campaign',
    'Redemptions (lifetime)',
    stats.eventQr.chartRedemptionsByCampaign.map((r) => ({
      a: r.name,
      b: String(r.redemptions),
    })),
  );

  y = drawSectionTitle(doc, y, 'VIP customers');
  doc.setFontSize(8);
  const vipHeaders = ['#', 'Name', 'Email', 'Total', 'Orders'];
  const cw0 = 22;
  const cw1 = 108;
  const cw3 = 78;
  const cw4 = 44;
  const cw2 = Math.max(96, contentW - cw0 - cw1 - cw3 - cw4 - 20);
  const cw = [cw0, cw1, cw2, cw3, cw4];
  let x = PDF_M;
  y = ensureSpace(doc, y, PDF_LINE + 4);
  doc.setFillColor(237, 233, 254);
  doc.rect(PDF_M, y - 9, contentW, PDF_LINE + 4, 'F');
  doc.setFont('helvetica', 'bold');
  vipHeaders.forEach((hText, i) => {
    doc.text(hText, x + 3, y);
    x += cw[i] ?? 60;
  });
  y += PDF_LINE + 6;
  doc.setFont('helvetica', 'normal');
  stats.topCustomers.forEach((r, i) => {
    y = ensureSpace(doc, y, PDF_LINE + 4);
    x = PDF_M;
    doc.text(String(i + 1), x + 3, y);
    x += cw[0]!;
    doc.text(doc.splitTextToSize(r.name, cw[1]! - 6)[0] || '', x + 3, y);
    x += cw[1]!;
    const em = doc.splitTextToSize(r.email, cw[2]! - 6)[0] || '';
    doc.text(em, x + 3, y);
    x += cw[2]!;
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(r.total), x + 3, y);
    x += cw[3]!;
    doc.text(String(r.orders), x + 3, y);
    doc.setFont('helvetica', 'normal');
    y += PDF_LINE + 2;
  });

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 110);
  const note =
    'Order metrics reflect the selected period. Where chart capture succeeded, diagrams are included; otherwise tables list the same values.';
  const noteLines = doc.splitTextToSize(note, contentW);
  noteLines.forEach((ln: string) => {
    y = ensureSpace(doc, y, PDF_LINE);
    doc.text(ln, PDF_M, y);
    y += PDF_LINE - 1;
  });

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(`Page ${i} of ${totalPages}`, w - PDF_M, h - 20, {
      align: 'right',
    });
  }

  const fileSlug = periodLabel.replace(/[^\w]+/g, '-').toLowerCase().slice(0, 32);
  doc.save(
    `bunnys-whisper-analytics-${fileSlug}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}
