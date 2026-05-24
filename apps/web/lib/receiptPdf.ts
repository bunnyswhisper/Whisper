import { jsPDF } from 'jspdf';
import { customerOrderStatusLabel } from '@/lib/orderStatusDisplay';
import { paymentMethodLabel, paymentStatusLabel } from '@/lib/paymentDisplay';

export type ReceiptLineItem = {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  lineTotal: number;
};

export type CustomerReceiptPdfInput = {
  createdAt: string | null | undefined;
  customerName: string;
  lineItems: ReceiptLineItem[];
  /** If lineItems is empty, show a single summary line with this count */
  itemUnitsFallback?: number;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  couponCode?: string | null;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus?: string | null;
};

export type AdminReceiptPdfInput = CustomerReceiptPdfInput & {
  orderId: string;
  claimCode?: string | null;
};

const MARGIN = 48;
const LINE = 13;
const PAGE_BOTTOM_PAD = 56;

function pageHeight(doc: jsPDF) {
  return doc.internal.pageSize.getHeight();
}

function pageWidth(doc: jsPDF) {
  return doc.internal.pageSize.getWidth();
}

function fmtMoney(n: number) {
  return `EGP ${Number(n || 0).toFixed(2)}`;
}

function formatReceiptDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ensureY(doc: jsPDF, y: number, block: number): number {
  const h = pageHeight(doc);
  if (y + block > h - PAGE_BOTTOM_PAD) {
    doc.addPage();
    return MARGIN + block;
  }
  return y + block;
}

function writeLines(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineHeight: number,
): number {
  const lines = doc.splitTextToSize(text, maxW);
  let cy = y;
  for (const line of lines) {
    cy = ensureY(doc, cy, lineHeight);
    doc.text(line, x, cy);
    cy += lineHeight;
  }
  return cy;
}

function drawCustomerReceiptBody(
  doc: jsPDF,
  input: CustomerReceiptPdfInput,
): number {
  const w = pageWidth(doc);
  const maxW = w - MARGIN * 2;
  let y = MARGIN;

  doc.setFillColor(76, 29, 120);
  doc.rect(0, 0, w, 6, 'F');
  doc.setFillColor(243, 232, 255);
  doc.rect(0, 6, w, 56, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(42, 17, 70);
  doc.text("BUNNY'S WHISPER", MARGIN, 34);
  doc.setFontSize(10.5);
  doc.text('Premium Order Receipt', MARGIN, 50);
  y = 74;
  doc.setTextColor(0, 0, 0);

  doc.setDrawColor(200, 200, 210);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Generated: ${new Date().toLocaleString()}`, MARGIN, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  y = ensureY(doc, y, LINE + 4);
  doc.text('Customer Details', MARGIN, y);
  y += LINE + 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Name', MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.text(input.customerName || '—', MARGIN + 100, y);
  y += LINE + 2;

  y += 8;
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Order Details', MARGIN, y);
  y += LINE + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const method = String(input.paymentMethod || '').toLowerCase();
  const status = String(input.paymentStatus || '').toLowerCase();
  const paymentStatusText =
    method === 'paymob' && status === 'paid'
      ? 'Paid securely by card'
      : method === 'paymob' && status === 'pending'
        ? 'Payment is being verified'
        : method === 'paymob' && (status === 'failed' || status === 'expired')
          ? 'Payment not completed'
          : method === 'cash_on_delivery'
            ? 'Cash on delivery'
            : paymentStatusLabel(input.paymentMethod, input.paymentStatus);
  const orderDetailsRows: [string, string][] = [
    ['Order date', formatReceiptDate(input.createdAt ?? null)],
    ['Payment method', paymentMethodLabel(input.paymentMethod)],
    ['Payment status', paymentStatusText],
  ];
  if (input.orderStatus != null && input.orderStatus !== '') {
    orderDetailsRows.push(['Order status', customerOrderStatusLabel(String(input.orderStatus))]);
  }
  orderDetailsRows.forEach(([k, v]) => {
    y = ensureY(doc, y, LINE);
    doc.setFont('helvetica', 'bold');
    doc.text(k, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    y = writeLines(doc, v, MARGIN + 100, y, maxW - 100, LINE);
  });
  y += 8;
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Items', MARGIN, y);
  y += LINE + 4;

  const columns = ['Item', 'Color', 'Size', 'Qty', 'Unit', 'Total'];
  const colW = [185, 70, 60, 40, 62, 62];
  doc.setFillColor(242, 238, 252);
  doc.rect(MARGIN, y - 9, maxW, LINE + 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  let hx = MARGIN + 3;
  columns.forEach((c, i) => {
    doc.text(c, hx, y);
    hx += colW[i] ?? 50;
  });
  y += LINE + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);

  if (input.lineItems.length > 0) {
    for (const row of input.lineItems) {
      const unitPrice = row.quantity > 0 ? row.lineTotal / row.quantity : row.lineTotal;
      const values = [
        row.productName || '—',
        row.color || '—',
        row.size || '—',
        String(row.quantity || 0),
        fmtMoney(unitPrice),
        fmtMoney(row.lineTotal),
      ];
      const lines = values.map((v, i) => doc.splitTextToSize(v, (colW[i] ?? 50) - 6));
      const rowH = Math.max(...lines.map((l) => l.length)) * 9 + 4;
      y = ensureY(doc, y, rowH + 3);
      let x = MARGIN + 3;
      lines.forEach((segment, i) => {
        doc.text(segment, x, y);
        x += colW[i] ?? 50;
      });
      y += rowH;
    }
  } else if (
    input.itemUnitsFallback != null &&
    input.itemUnitsFallback > 0
  ) {
    y = writeLines(
      doc,
      `All items (total units): ${input.itemUnitsFallback}`,
      MARGIN,
      y,
      maxW,
      LINE,
    );
  } else {
    y = writeLines(doc, '—', MARGIN, y, maxW, LINE);
  }

  y += 8;
  y = ensureY(doc, y, 8);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Payment Summary', MARGIN, y);
  y += LINE + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const rows: [string, string][] = [
    ['Subtotal', fmtMoney(input.subtotal)],
    ['Delivery fee', fmtMoney(input.deliveryFee)],
  ];

  if (Number(input.discountAmount || 0) > 0) {
    rows.push(['Discount', `− ${fmtMoney(input.discountAmount)}`]);
    if (input.couponCode) {
      rows.push(['Coupon', String(input.couponCode)]);
    }
  }

  rows.push(['Total', fmtMoney(input.total)]);

  for (const [k, v] of rows) {
    y = ensureY(doc, y, LINE);
    doc.setFont('helvetica', 'bold');
    doc.text(k, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, w - MARGIN - 2, y, { align: 'right' });
    y += LINE + 2;
  }

  y += 10;
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 14;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  y = ensureY(doc, y, LINE);
  doc.text('Thank you for shopping with Bunny’s Whisper.', MARGIN, y);
  y += LINE;

  return y;
}

function safeFilenamePart(s: string) {
  return s.replace(/[^\w\-]+/g, '-').slice(0, 40);
}

export function downloadCustomerReceiptPdf(
  input: CustomerReceiptPdfInput,
  filenameBase = 'bunnys-whisper-receipt',
) {
  const doc = buildCustomerReceiptPdfDoc(input);
  const stamp = input.createdAt
    ? safeFilenamePart(new Date(input.createdAt).toISOString().slice(0, 10))
    : 'order';
  doc.save(`${filenameBase}-${stamp}.pdf`);
}

export function downloadAdminReceiptPdf(input: AdminReceiptPdfInput) {
  const doc = buildAdminReceiptPdfDoc(input);
  const shortId = input.orderId.replace(/-/g, '').slice(0, 10);
  doc.save(`admin-receipt-${shortId}.pdf`);
}

export function buildCustomerReceiptPdfDoc(input: CustomerReceiptPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  drawCustomerReceiptBody(doc, input);
  return doc;
}

export function buildAdminReceiptPdfDoc(input: AdminReceiptPdfInput): jsPDF {
  return buildCustomerReceiptPdfDoc(input);
}

function printDoc(doc: jsPDF) {
  const blobUrl = doc.output('bloburl');
  const w = window.open(blobUrl, '_blank');
  if (!w) return;
  w.addEventListener('load', () => {
    w.focus();
    w.print();
  });
}

export function printCustomerReceiptPdf(input: CustomerReceiptPdfInput) {
  printDoc(buildCustomerReceiptPdfDoc(input));
}

export function printAdminReceiptPdf(input: AdminReceiptPdfInput) {
  printDoc(buildAdminReceiptPdfDoc(input));
}
