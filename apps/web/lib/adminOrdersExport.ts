import { jsPDF } from 'jspdf';
import { adminPaymentStatusLabel } from '@/lib/paymentDisplay';
import { csvLine } from '@/lib/csvExport';

export type AdminOrderExportRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  city: string;
  area: string;
  street: string;
  subtotal: number;
  delivery_fee: number;
  discount_amount?: number | null;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
  return_reason?: string | null;
  order_items: {
    product_name: string;
    color: string;
    size: string;
    quantity: number;
  }[];
};

export type OrdersExportFilters = {
  monthLabel?: string;
  statusFilterLabel: string;
  customerViewLabel: string;
  searchText: string;
};

function reportTitle(monthLabel?: string): string {
  const normalized = String(monthLabel || '').trim();
  if (!normalized || normalized.toLowerCase() === 'all time') {
    return "Bunny's Whisper Orders Report";
  }
  return `${normalized} Orders Report`;
}

function money(v: number): string {
  return Number(v || 0).toFixed(2);
}

function normalizeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || '';
  return d.toLocaleString();
}

function itemsSummary(order: AdminOrderExportRow): string {
  return (order.order_items || [])
    .map(
      (it) =>
        `${it.product_name} (${it.color}/${it.size}) x${Number(it.quantity || 0)}`,
    )
    .join(' | ');
}

export function adminFriendlyPaymentMethod(method: string): string {
  const m = String(method || '').toLowerCase();
  if (m === 'paymob') return 'Card (Paymob)';
  if (m === 'cash_on_delivery') return 'Cash on delivery';
  return method || '—';
}

export function adminFriendlyOrderStatus(status: string): string {
  const s = String(status || '').toLowerCase();
  if (s === 'pending' || s === 'confirmed') return 'Placed';
  if (s === 'shipped') return 'Shipped';
  if (s === 'delivered') return 'Delivered';
  if (s === 'cancelled') return 'Cancelled';
  return status || '—';
}

export function buildOrdersCsv(
  orders: AdminOrderExportRow[],
  filters: OrdersExportFilters,
): string {
  const lines: string[] = [];
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const collectedRevenue = orders
    .filter((o) => String(o.payment_status || '').toLowerCase() === 'paid')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingPayments = orders.filter((o) => {
    const s = String(o.payment_status || '').toLowerCase();
    return s === 'pending' || s === 'unpaid';
  }).length;
  const failedPayments = orders.filter((o) => {
    const s = String(o.payment_status || '').toLowerCase();
    return s === 'failed' || s === 'expired';
  }).length;
  lines.push(csvLine([reportTitle(filters.monthLabel)]));
  lines.push(csvLine(['Generated at', new Date().toISOString()]));
  lines.push(csvLine(['Month', filters.monthLabel || 'All time']));
  lines.push(csvLine(['Status filter', filters.statusFilterLabel]));
  lines.push(csvLine(['Customer view', filters.customerViewLabel]));
  lines.push(csvLine(['Search text', filters.searchText || '—']));
  lines.push(csvLine(['Visible orders count', orders.length]));
  lines.push(csvLine(['Total revenue', money(totalRevenue)]));
  lines.push(csvLine(['Collected revenue', money(collectedRevenue)]));
  lines.push(csvLine(['Pending payments', pendingPayments]));
  lines.push(csvLine(['Failed payments', failedPayments]));
  lines.push('');
  lines.push(
    csvLine([
      'Order ID',
      'Date',
      'Customer Name',
      'Phone',
      'Email',
      'City',
      'Area',
      'Street',
      'Items Summary',
      'Subtotal',
      'Delivery Fee',
      'Discount',
      'Total',
      'Payment Method',
      'Payment Status',
      'Order Status',
      'Return Reason',
    ]),
  );

  orders.forEach((o) => {
    lines.push(
      csvLine([
        o.id,
        normalizeDate(o.created_at),
        o.customer_name || '',
        o.customer_phone || '',
        o.customer_email || '',
        o.city || '',
        o.area || '',
        o.street || '',
        itemsSummary(o),
        money(o.subtotal),
        money(o.delivery_fee),
        money(Number(o.discount_amount || 0)),
        money(o.total),
        adminFriendlyPaymentMethod(o.payment_method || ''),
        adminPaymentStatusLabel(
          o.payment_method || '',
          o.payment_status || '',
          o.status || '',
        ),
        adminFriendlyOrderStatus(o.status || ''),
        o.return_reason || '',
      ]),
    );
  });

  return '\uFEFF' + lines.join('\n');
}

export function downloadOrdersCsv(
  orders: AdminOrderExportRow[],
  filters: OrdersExportFilters,
) {
  const csv = buildOrdersCsv(orders, filters);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bunnys-whisper-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadOrdersPdf(
  orders: AdminOrderExportRow[],
  filters: OrdersExportFilters,
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentW = pageW - margin * 2;
  const line = 11;
  let y = margin;

  const totalValue = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const collectedRevenue = orders
    .filter((o) => String(o.payment_status || '').toLowerCase() === 'paid')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const pendingPayments = orders.filter((o) => {
    const s = String(o.payment_status || '').toLowerCase();
    return s === 'pending' || s === 'unpaid';
  }).length;
  const failedPayments = orders.filter((o) => {
    const s = String(o.payment_status || '').toLowerCase();
    return s === 'failed' || s === 'expired';
  }).length;
  const subtotalValue = orders.reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
  const discountValue = orders.reduce(
    (sum, o) => sum + Number(o.discount_amount || 0),
    0,
  );

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 42) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFillColor(76, 29, 120);
  doc.rect(0, 0, pageW, 6, 'F');
  doc.setFillColor(243, 232, 255);
  doc.rect(0, 6, pageW, 52, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(45, 15, 70);
  doc.text(reportTitle(filters.monthLabel), margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(88, 72, 108);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 52);
  y = 76;
  doc.setTextColor(0, 0, 0);

  const metaRows = [
    ['Month', filters.monthLabel || 'All time'],
    ['Status filter', filters.statusFilterLabel],
    ['Customer view', filters.customerViewLabel],
    ['Search text', filters.searchText || '—'],
    ['Visible orders', String(orders.length)],
    ['Total revenue', `EGP ${money(totalValue)}`],
    ['Collected revenue', `EGP ${money(collectedRevenue)}`],
    ['Pending payments', String(pendingPayments)],
    ['Failed payments', String(failedPayments)],
    ['Visible subtotal', `EGP ${money(subtotalValue)}`],
    ['Visible discounts', `EGP ${money(discountValue)}`],
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Active filters and totals', margin, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  metaRows.forEach(([k, v]) => {
    ensureSpace(line + 3);
    doc.text(k, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(v, margin + contentW * 0.45, y);
    doc.setFont('helvetica', 'normal');
    y += line + 2;
  });

  y += 8;
  doc.setDrawColor(190, 190, 210);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Visible orders', margin, y);
  y += 14;

  const headers = ['Date / ID', 'Customer', 'Address', 'Items', 'Payment / Status', 'Total'];
  const colW = [94, 94, 96, 120, 90, 56];
  const rowPad = 2;

  const drawHeader = () => {
    ensureSpace(line + 8);
    let x = margin;
    doc.setFillColor(237, 233, 254);
    doc.rect(margin, y - 10, contentW, line + 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    headers.forEach((h, i) => {
      doc.text(h, x + 3, y);
      x += colW[i] || 50;
    });
    y += line + 5;
    doc.setFont('helvetica', 'normal');
  };

  drawHeader();
  doc.setFontSize(7.6);

  orders.forEach((o, idx) => {
    const cells = [
      `${normalizeDate(o.created_at)}\n${o.id}`,
      `${o.customer_name}\n${o.customer_phone}\n${o.customer_email || 'No email'}`,
      `${o.city}, ${o.area}\n${o.street}`,
      itemsSummary(o) || '—',
      `${adminFriendlyPaymentMethod(o.payment_method)} / ${adminPaymentStatusLabel(o.payment_method, o.payment_status, o.status)}\n${adminFriendlyOrderStatus(o.status)}${o.return_reason ? `\nReturn: ${o.return_reason}` : ''}`,
      `EGP ${money(o.total)}`,
    ];
    const lineBlocks = cells.map((c, i) => doc.splitTextToSize(c, (colW[i] || 50) - 6));
    const rowHeight = Math.max(...lineBlocks.map((l) => l.length)) * (line - 1) + rowPad * 2;
    ensureSpace(rowHeight + 4);
    if (idx > 0 && y + rowHeight > pageH - 52) {
      doc.addPage();
      y = margin;
      drawHeader();
    }
    if (idx % 2 === 0) {
      doc.setFillColor(250, 248, 255);
      doc.rect(margin, y - 8, contentW, rowHeight + 2, 'F');
    }
    let x = margin;
    lineBlocks.forEach((lines, i) => {
      doc.text(lines, x + 3, y);
      x += colW[i] || 50;
    });
    y += rowHeight + 3;
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 20, { align: 'right' });
  }

  doc.save(`bunnys-whisper-orders-${new Date().toISOString().slice(0, 10)}.pdf`);
}
