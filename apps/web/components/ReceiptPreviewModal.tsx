'use client';

import { useEffect, useState } from 'react';
import { formatIsoUtcDateTime } from '@/lib/formatIsoDate';
import { interactivePressable } from '@/lib/interactivePressable';
import { paymentMethodLabel, paymentStatusLabel } from '@/lib/paymentDisplay';
import { customerOrderStatusLabel } from '@/lib/orderStatusDisplay';

type ReceiptPreviewLine = {
  productName: string;
  color: string;
  size: string;
  quantity: number;
  lineTotal: number;
};

type Props = {
  open: boolean;
  title?: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  addressLine?: string | null;
  createdAt?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus?: string | null;
  subtotal: number;
  deliveryFee: number;
  discountAmount?: number;
  total: number;
  lineItems: ReceiptPreviewLine[];
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
};

function money(v: number) {
  return `EGP ${Number(v || 0).toFixed(2)}`;
}

export function ReceiptPreviewModal({
  open,
  title = "Bunny's Whisper Receipt Preview",
  customerName,
  customerPhone,
  customerEmail,
  addressLine,
  createdAt,
  paymentMethod,
  paymentStatus,
  orderStatus,
  subtotal,
  deliveryFee,
  discountAmount = 0,
  total,
  lineItems,
  onClose,
  onDownload,
  onPrint,
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
  return (
    <div className="fixed inset-0 z-10000 overflow-y-auto bg-black/75 px-3 py-20 sm:px-6">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-purple-400/30 bg-[#0d0716]">
        <div className="border-b border-purple-950/80 bg-linear-to-r from-[#12081f] to-[#0d0716] px-4 py-4 sm:px-6">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-300">Receipt preview</p>
          <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">{title}</h2>
          <p className="mt-1 text-xs text-gray-400">
            Generated{' '}
            {generatedIso ? formatIsoUtcDateTime(generatedIso) : '…'}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-3 rounded-2xl border border-purple-950 bg-[#07030d] p-4">
            <p className="text-sm font-bold text-purple-200">Premium Order Receipt</p>
            <div className="grid gap-2 text-sm text-gray-200 sm:grid-cols-2">
              <p>
                <span className="text-gray-400">Order date:</span>{' '}
                {createdAt ? formatIsoUtcDateTime(createdAt) : '—'}
              </p>
              <p><span className="text-gray-400">Customer:</span> {customerName}</p>
              {customerPhone ? <p><span className="text-gray-400">Phone:</span> {customerPhone}</p> : null}
              {customerEmail ? <p><span className="text-gray-400">Email:</span> {customerEmail}</p> : null}
              {addressLine ? <p className="sm:col-span-2"><span className="text-gray-400">Address:</span> {addressLine}</p> : null}
              <p><span className="text-gray-400">Payment:</span> {paymentMethodLabel(paymentMethod)}</p>
              <p><span className="text-gray-400">Status:</span> {paymentStatusLabel(paymentMethod, paymentStatus)}</p>
              {orderStatus ? <p className="sm:col-span-2"><span className="text-gray-400">Order status:</span> {customerOrderStatusLabel(orderStatus)}</p> : null}
            </div>
            <div className="overflow-x-auto rounded-xl border border-purple-950">
              <table className="w-full min-w-[560px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#0d0716] text-purple-300">
                    <th className="px-3 py-2">Item</th><th className="px-3 py-2">Color</th><th className="px-3 py-2">Size</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, i) => (
                    <tr key={i} className="border-t border-purple-950/70">
                      <td className="px-3 py-2">{it.productName}</td><td className="px-3 py-2">{it.color}</td><td className="px-3 py-2">{it.size}</td><td className="px-3 py-2">{it.quantity}</td><td className="px-3 py-2">{money(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ml-auto w-full max-w-sm space-y-1 rounded-xl border border-purple-950 bg-[#0b0715] p-3 text-sm">
              <p className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>{money(subtotal)}</span></p>
              <p className="flex justify-between"><span className="text-gray-400">Delivery fee</span><span>{money(deliveryFee)}</span></p>
              {discountAmount > 0 ? <p className="flex justify-between"><span className="text-green-300">Discount</span><span className="text-green-300">- {money(discountAmount)}</span></p> : null}
              <p className="flex justify-between border-t border-purple-950 pt-2 text-base font-bold"><span>Total</span><span>{money(total)}</span></p>
            </div>
          </div>
        </div>
        <div className="border-t border-purple-950/80 bg-[#07030d] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={`rounded-full border border-purple-800/80 bg-[#0d0716] px-5 py-2.5 text-sm font-bold text-purple-100 ${interactivePressable}`}>Close</button>
            <button type="button" onClick={onPrint} className={`rounded-full border border-purple-300/70 bg-purple-500/15 px-5 py-2.5 text-sm font-bold text-purple-100 ${interactivePressable}`}>Print</button>
            <button type="button" onClick={onDownload} className={`rounded-full border border-purple-300 bg-purple-300 px-5 py-2.5 text-sm font-bold text-black ${interactivePressable}`}>Download PDF</button>
          </div>
        </div>
      </div>
    </div>
  );
}
