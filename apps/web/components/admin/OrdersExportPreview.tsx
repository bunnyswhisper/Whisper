'use client';

import { useEffect, useState } from 'react';
import { formatIsoUtcDateTime } from '@/lib/formatIsoDate';
import { interactivePressable } from '@/lib/interactivePressable';
import {
  adminFriendlyOrderStatus,
  adminFriendlyPaymentMethod,
  type AdminOrderExportRow,
  type OrdersExportFilters,
} from '@/lib/adminOrdersExport';
import { adminPaymentStatusLabel } from '@/lib/paymentDisplay';

type Props = {
  open: boolean;
  onClose: () => void;
  filters: OrdersExportFilters;
  rows: AdminOrderExportRow[];
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
};

function money(v: number) {
  return `EGP ${Number(v || 0).toFixed(2)}`;
}

export function OrdersExportPreview({
  open,
  onClose,
  filters,
  rows,
  onDownloadPdf,
  onDownloadCsv,
}: Props) {
  const [generatedIso, setGeneratedIso] = useState('');

  useEffect(() => {
    if (!open) {
      setGeneratedIso('');
      return;
    }
    setGeneratedIso(new Date().toISOString());
  }, [open]);

  if (!open) return null;
  const subtotal = rows.reduce((sum, r) => sum + Number(r.subtotal || 0), 0);
  const discount = rows.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0);
  const total = rows.reduce((sum, r) => sum + Number(r.total || 0), 0);
  const collectedRevenue = rows
    .filter((r) => String(r.payment_status || '').toLowerCase() === 'paid')
    .reduce((sum, r) => sum + Number(r.total || 0), 0);
  const pendingPayments = rows.filter((r) => {
    const s = String(r.payment_status || '').toLowerCase();
    return s === 'pending' || s === 'unpaid';
  }).length;
  const failedPayments = rows.filter((r) => {
    const s = String(r.payment_status || '').toLowerCase();
    return s === 'failed' || s === 'expired';
  }).length;
  const generatedAt = generatedIso ? formatIsoUtcDateTime(generatedIso) : '…';
  const title =
    filters.monthLabel && filters.monthLabel !== 'All Time'
      ? `${filters.monthLabel} Orders Report`
      : "Bunny's Whisper Orders Report";
  return (
    <div className="fixed inset-0 z-10000 overflow-y-auto bg-black/75 px-3 py-20 sm:px-6">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-purple-400/30 bg-[#0d0716]">
        <div className="border-b border-purple-950/80 bg-linear-to-r from-[#12081f] to-[#0d0716] px-4 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-300">Export preview</p>
          <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">{title}</h2>
          <p className="mt-1 text-xs text-gray-400">Generated {generatedAt}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="grid gap-3 rounded-2xl border border-purple-950 bg-[#07030d] p-4 text-sm text-gray-200 sm:grid-cols-2">
            <p><span className="text-gray-400">Month:</span> {filters.monthLabel || 'All time'}</p>
            <p><span className="text-gray-400">Status filter:</span> {filters.statusFilterLabel}</p>
            <p><span className="text-gray-400">Customer view:</span> {filters.customerViewLabel}</p>
            <p className="sm:col-span-2"><span className="text-gray-400">Search:</span> {filters.searchText || '—'}</p>
            <p><span className="text-gray-400">Visible orders:</span> {rows.length}</p>
            <p><span className="text-gray-400">Total revenue:</span> {money(total)}</p>
            <p><span className="text-gray-400">Collected revenue:</span> {money(collectedRevenue)}</p>
            <p><span className="text-gray-400">Pending payments:</span> {pendingPayments}</p>
            <p><span className="text-gray-400">Failed payments:</span> {failedPayments}</p>
            <p><span className="text-gray-400">Subtotal:</span> {money(subtotal)}</p>
            <p><span className="text-gray-400">Discounts:</span> {money(discount)}</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-purple-950 bg-[#07030d]">
            <table className="w-full min-w-[980px] text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-purple-950/70 bg-[#0d0716] text-purple-200">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2">Order ID</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Address</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Payment</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 30).map((r) => (
                  <tr key={r.id} className="border-b border-purple-950/50 last:border-0">
                    <td className="px-3 py-2">{formatIsoUtcDateTime(r.created_at)}</td>
                    <td className="px-3 py-2 font-mono">{r.id}</td>
                    <td className="px-3 py-2">{r.customer_name}</td>
                    <td className="px-3 py-2">{r.city}, {r.area}, {r.street}</td>
                    <td className="px-3 py-2">{r.order_items.map((it) => `${it.product_name} x${it.quantity}`).join(', ')}</td>
                    <td className="px-3 py-2">
                      {adminFriendlyPaymentMethod(r.payment_method)} /{' '}
                      {adminPaymentStatusLabel(
                        r.payment_method,
                        r.payment_status,
                        r.status,
                      )}
                    </td>
                    <td className="px-3 py-2">{adminFriendlyOrderStatus(r.status)}</td>
                    <td className="px-3 py-2">{money(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="border-t border-purple-950/80 bg-[#07030d] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={`rounded-full border border-purple-800/80 bg-[#0d0716] px-5 py-2.5 text-sm font-bold text-purple-100 ${interactivePressable}`}>Cancel</button>
            <button type="button" onClick={onDownloadPdf} className={`rounded-full border border-purple-300 bg-purple-300 px-5 py-2.5 text-sm font-bold text-black ${interactivePressable}`}>Download PDF</button>
            <button type="button" onClick={onDownloadCsv} className={`rounded-full border border-purple-300/70 bg-purple-500/15 px-5 py-2.5 text-sm font-bold text-purple-100 ${interactivePressable}`}>Download CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
}
