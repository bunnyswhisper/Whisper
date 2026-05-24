'use client';

import QRCode from 'qrcode';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabaseClient';
import { apiUrl, siteUrl } from '@/lib/api';
import {
  ADMIN_ORDER_STATUS_ACTIONS,
  adminPrimaryHighlightKey,
  adminStatusActionBorder,
  adminStatusActionHighlightClass,
  customerOrderStatusLabel,
  isAdminStatusActionDisabled,
} from '@/lib/orderStatusDisplay';
import AdminOnly from '@/components/AdminOnly';
import { PremiumEmptyState } from '@/components/empty-state';
import { interactivePressable } from '@/lib/interactivePressable';
import {
  adminPaymentStatusLabel,
  paymentMethodLabel,
} from '@/lib/paymentDisplay';
import {
  downloadAdminReceiptPdf,
  printAdminReceiptPdf,
  type AdminReceiptPdfInput,
} from '@/lib/receiptPdf';
import {
  downloadOrdersCsv,
  downloadOrdersPdf,
} from '@/lib/adminOrdersExport';
import { OrdersExportPreview } from '@/components/admin/OrdersExportPreview';
import { ReceiptPreviewModal } from '@/components/ReceiptPreviewModal';
import { isSecureOrderClaimCodeForPrint } from '@/lib/orderClaimCode';
import { buildRewardCardPrintHtml } from '@/lib/rewardCardPrint';
import { generateSocialQrDataUrls } from '@/lib/rewardCard/socialQrDataUrls';
import {
  computeAdminOrderRollups,
  getAdminOrderTotal,
  isNonCancelledOrder,
} from '@/lib/adminOrderMetrics';

type OrderItem = {
  id: string;
  product_name: string;
  size: string;
  color: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type Order = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  city: string;
  area: string;
  street: string;
  notes: string | null;
  subtotal: number;
  total: number;
  status: string;
  payment_method: string;
  payment_status: string;
  created_at: string;
  order_items: OrderItem[];
  vat_amount: number;
  delivery_fee: number;
  discount_amount?: number | null;
  discount_source?: string | null;
  event_campaign_id?: string | null;
  event_discount_percent?: number | null;
  coupon_code?: string | null;
  claim_code?: string | null;
  points_awarded?: number | null;
  points_claimed?: boolean | null;
  return_reason?: string | null;
  returned_at?: string | null;
  points_reversed?: boolean | null;
  points_reversed_at?: string | null;
  uncancelled_at?: string | null;
  uncancel_reason?: string | null;
  uncancelled_by?: string | null;
};

type AdminMainOrderFilter =
  | 'all'
  | 'placed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'uncancelled';

const ADMIN_MAIN_FILTER_OPTIONS: { id: AdminMainOrderFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'placed', label: 'Placed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'uncancelled', label: 'Uncancelled' },
];

function normalizeOrderStatus(status: string | undefined | null): string {
  return String(status || '')
    .toLowerCase()
    .trim();
}

function orderMatchesMainFilter(
  order: Order,
  filter: AdminMainOrderFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'uncancelled') return Boolean(order.uncancelled_at);
  const s = normalizeOrderStatus(order.status);
  if (filter === 'placed') return s === 'pending' || s === 'confirmed';
  if (filter === 'shipped') return s === 'shipped';
  if (filter === 'delivered') return s === 'delivered';
  if (filter === 'cancelled') return s === 'cancelled';
  return true;
}

function money(value: number) {
  return `EGP ${Number(value || 0).toFixed(2)}`;
}

function statusClass(status: string) {
  if (status === 'pending' || status === 'confirmed') {
    return 'border-purple-300/40 bg-purple-500/15 text-purple-100';
  }
  if (status === 'shipped') return 'border-blue-300/40 bg-blue-500/15 text-blue-100';
  if (status === 'delivered') return 'border-green-300/40 bg-green-500/15 text-green-100';
  if (status === 'cancelled') return 'border-red-300/40 bg-red-500/15 text-red-100';
  return 'border-purple-950 bg-[#05070d] text-purple-200';
}

function orderMonthKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(ym: string) {
  if (ym === 'all') return 'All Time';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function adminOrderToReceiptPdfPayload(order: Order): AdminReceiptPdfInput {
  const subtotal = Number(order.subtotal || 0);
  const deliveryFee = Number(order.delivery_fee ?? subtotal * 0.12);
  const discountAmount = Number(order.discount_amount || 0);
  return {
    createdAt: order.created_at,
    customerName: order.customer_name,
    lineItems: order.order_items.map((it) => ({
      productName: it.product_name,
      color: it.color,
      size: it.size,
      quantity: it.quantity,
      lineTotal: Number(it.total_price || 0),
    })),
    subtotal,
    deliveryFee,
    discountAmount,
    couponCode: order.coupon_code ?? null,
    total: getAdminOrderTotal(order),
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    orderStatus: order.status,
    orderId: order.id,
    claimCode: order.claim_code || null,
  };
}

function shortenOrderId(id: string) {
  if (!id) return '—';
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…`;
}

function uncancelledBadge() {
  return (
    <span className="inline-flex rounded-full border border-cyan-400/55 bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100">
      Uncancelled
    </span>
  );
}

function mainFilterExportLabel(filter: AdminMainOrderFilter): string {
  return (
    ADMIN_MAIN_FILTER_OPTIONS.find((o) => o.id === filter)?.label ?? filter
  );
}

/** Stable group id: email → phone → name (lowercased). Avoids merging different people who share a name but have different contact info. */
function customerGroupKey(order: Order): string {
  const email = (order.customer_email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const phone = (order.customer_phone || '').trim();
  if (phone) return `phone:${phone}`;
  const name = (order.customer_name || '').trim().toLowerCase();
  return `name:${name || 'unknown'}`;
}

const FRIENDLY_STATUS_SUMMARY_ORDER = ['Placed', 'Shipped', 'Delivered', 'Cancelled'] as const;

/** Always four buckets (incl. zeros) for customer card summary, e.g. Placed: 3, Cancelled: 0 */
function groupFriendlyStatusCountsAll(orders: Order[]): { label: string; count: number }[] {
  return FRIENDLY_STATUS_SUMMARY_ORDER.map((label) => ({
    label,
    count: orders.filter((o) => customerOrderStatusLabel(o.status) === label).length,
  }));
}

type CustomerViewStatusFilter =
  | 'all'
  | 'placed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'uncancelled';

const CUSTOMER_VIEW_STATUS_OPTIONS: { id: CustomerViewStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'placed', label: 'Placed' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'uncancelled', label: 'Uncancelled' },
];

function orderMatchesCustomerViewFilter(
  order: Order,
  filter: CustomerViewStatusFilter,
): boolean {
  if (filter === 'all') return true;
  const s = normalizeOrderStatus(order.status);
  if (filter === 'placed') return s === 'pending' || s === 'confirmed';
  if (filter === 'shipped') return s === 'shipped';
  if (filter === 'delivered') return s === 'delivered';
  if (filter === 'cancelled') return s === 'cancelled';
  if (filter === 'uncancelled') return Boolean(order.uncancelled_at);
  return true;
}

function orderMatchesCustomerOrderSearch(order: Order, q: string): boolean {
  if (!q) return true;
  const hay = [
    order.id,
    order.customer_name,
    order.customer_phone,
    order.customer_email || '',
    order.city,
    order.area,
    order.street,
    order.payment_method,
    order.payment_status,
    order.claim_code || '',
    order.return_reason || '',
    order.uncancel_reason || '',
    order.uncancelled_at || '',
    customerOrderStatusLabel(order.status),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

type CustomerOrderGroup = {
  key: string;
  displayName: string;
  phone: string;
  email: string | null;
  orders: Order[];
  orderCount: number;
  totalSpent: number;
  latestAt: number;
  statusCounts: { label: string; count: number }[];
};

type AdminOrderDetailBodyProps = {
  order: Order;
  isUpdating: boolean;
  onPrintClaimCard: (order: Order) => void;
  onPreviewReceipt: (order: Order) => void;
  onUpdateStatus: (orderId: string, status: string) => void;
  onOpenReturnModal: (order: Order) => void;
  onRequestUncancel: (order: Order) => void;
};

function AdminOrderDetailBody({
  order,
  isUpdating,
  onPrintClaimCard,
  onPreviewReceipt,
  onUpdateStatus,
  onOpenReturnModal,
  onRequestUncancel,
}: AdminOrderDetailBodyProps) {
  const subtotal = Number(order.subtotal || 0);
  const deliveryFee = Number(order.delivery_fee ?? subtotal * 0.12);
  const discount = Number(order.discount_amount || 0);
  const total = getAdminOrderTotal(order);
  const statusKey = normalizeOrderStatus(order.status);
  const isDelivered = statusKey === 'delivered';
  const isClaimed = Boolean(order.points_claimed);
  const isCancelled = statusKey === 'cancelled';
  const hasReturnException = Boolean(order.return_reason || order.returned_at);
  const actuallyReversedPoints =
    Boolean(order.points_reversed) && Number(order.points_awarded || 0) > 0;
  /** Final lifecycle states only — points flags never lock admin status changes on open orders. */
  const isOrderLocked =
    isDelivered || statusKey === 'returned' || hasReturnException;
  const claimOkForPrint =
    Boolean(order.claim_code?.trim()) &&
    isSecureOrderClaimCodeForPrint(order.claim_code);

  return (
    <div className="mt-4 border-t border-purple-950/70 pt-5 sm:pt-6">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-purple-400">
        Full details
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-purple-300">Order</p>

          <h2 className="mt-2 text-xl font-bold">{order.customer_name}</h2>

          <p className="text-sm text-gray-400">{new Date(order.created_at).toLocaleString()}</p>

          <p className="mt-1 break-all text-xs text-gray-500">ID: {order.id}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p
              className={`inline-block rounded-full border px-4 py-2 text-sm font-bold capitalize ${statusClass(
                order.status,
              )}`}
            >
              {customerOrderStatusLabel(order.status)}
            </p>
            {order.uncancelled_at ? (
              <span className="inline-flex items-center">{uncancelledBadge()}</span>
            ) : null}
          </div>

          {actuallyReversedPoints ? (
            <p className="mt-2 text-xs text-red-200/90">
              Points were reversed on this order (history). Claim is allowed again only after it is
              marked delivered and points are eligible.
            </p>
          ) : null}

          {order.uncancelled_at ? (
            <div className="mt-4 rounded-xl border border-cyan-500/35 bg-cyan-950/25 p-4 text-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200/90">
                Uncancelled (audit)
              </p>
              <p className="mt-2 text-gray-200">
                <span className="text-gray-500">Date:</span>{' '}
                {new Date(order.uncancelled_at).toLocaleString()}
              </p>
              {order.uncancel_reason ? (
                <p className="mt-2 text-gray-200">
                  <span className="text-gray-500">Reason:</span> {order.uncancel_reason}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="text-left lg:text-right">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between gap-4 lg:justify-end">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-purple-200">{money(subtotal)}</span>
            </div>

            <div className="flex justify-between gap-4 lg:justify-end">
              <span className="text-gray-400">Delivery Fee</span>
              <span className="text-purple-200">{money(deliveryFee)}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between gap-4 lg:justify-end">
                <span className="text-green-300">Discount</span>
                <span className="text-green-300">- {money(discount)}</span>
              </div>
            )}

            <div className="mt-2 border-t border-purple-950 pt-2">
              <p className="text-2xl font-black text-purple-300">{money(total)}</p>
            </div>
          </div>

          <p className="mt-1 text-sm text-gray-400">
            {adminPaymentStatusLabel(
              order.payment_method,
              order.payment_status,
              order.status,
            )}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            {paymentMethodLabel(order.payment_method)}
          </p>

          {order.coupon_code && (
            <p className="mt-1 text-sm text-green-300">Coupon: {order.coupon_code}</p>
          )}

          <button
            type="button"
            onClick={() => onPreviewReceipt(order)}
            className={`mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-purple-300/55 bg-purple-500/15 px-4 py-2.5 text-xs font-bold text-purple-100 sm:w-auto sm:text-sm ${interactivePressable}`}
          >
            Print Receipt
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-purple-950 bg-[#05070d] p-4">
          <h3 className="font-bold text-purple-200">Customer</h3>

          <p className="mt-2 text-gray-300">{order.customer_phone}</p>

          <p className="text-gray-300">{order.customer_email || 'No email'}</p>

          <p className="mt-2 text-gray-300">
            {order.city}, {order.area}, {order.street}
          </p>

          {order.notes && (
            <p className="mt-2 text-sm text-gray-400">Notes: {order.notes}</p>
          )}
        </div>

        <div className="rounded-2xl border border-purple-950 bg-[#05070d] p-4">
          <h3 className="font-bold text-purple-200">Items</h3>

          <div className="mt-3 space-y-2">
            {order.order_items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 rounded-xl border border-purple-950 bg-[#0d0716] p-3 text-sm sm:flex-row sm:justify-between"
              >
                <span className="text-gray-300">
                  {item.product_name} / {item.color} / {item.size} × {item.quantity}
                </span>

                <span className="text-purple-300">
                  {money(Number(item.total_price || 0))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hasReturnException && (
        <div className="mt-5 rounded-2xl border border-red-300/40 bg-red-500/10 p-4 text-red-100">
          <h3 className="font-bold">Returned / Cancelled Exception</h3>

          <p className="mt-2 text-sm">Reason: {order.return_reason || 'No reason saved'}</p>

          <p className="mt-1 text-sm">
            Points reversed:{' '}
            {actuallyReversedPoints ? Number(order.points_awarded || 0) : 0}
          </p>

          {order.returned_at && (
            <p className="mt-1 text-sm text-red-200">
              Returned at: {new Date(order.returned_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {!isCancelled && (
        <>
          <div className="mt-5 rounded-2xl border border-purple-950 bg-[#05070d] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="font-bold text-purple-200">Bunny Points QR Card</h3>

                {order.claim_code ? (
                  <>
                    <p className="mt-2 break-all text-sm text-gray-300">
                      Claim Code: {order.claim_code}
                    </p>

                    <p className="mt-1 text-sm text-gray-400">
                      Claim Status:{' '}
                      {isClaimed ? (
                        <span className="font-bold text-green-300">Claimed</span>
                      ) : (
                        <span className="font-bold text-yellow-300">Not claimed yet</span>
                      )}
                    </p>

                    <p className="mt-1 text-sm text-purple-300">
                      Points Awarded: {Number(order.points_awarded || 0)}
                    </p>

                    {actuallyReversedPoints && (
                      <p className="mt-1 text-sm text-red-300">Points Reversed: Yes</p>
                    )}

                    {!claimOkForPrint && (
                      <div className="mt-3 rounded-xl border border-amber-400/45 bg-amber-500/12 px-3 py-2.5 text-sm text-amber-100">
                        <p className="font-bold text-amber-50">
                          Do not print this reward card
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-amber-100/95">
                          {!order.claim_code?.trim() ? (
                            <>
                              Claim code is empty or whitespace-only. Regenerate a secure code (
                              <span className="font-mono text-[11px] text-amber-50/95">
                                BW-ORDER-XXXX-XXXX-XXXX
                              </span>
                              ) before printing.
                            </>
                          ) : (
                            <>
                              This claim code is not in the secure format (expected{' '}
                              <span className="font-mono text-[11px] text-amber-50/95">
                                BW-ORDER-XXXX-XXXX-XXXX
                              </span>
                              ). Fix or regenerate it before distributing QR inserts.
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-red-300">No claim code found for this order.</p>
                )}
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => onPrintClaimCard(order)}
                  disabled={!claimOkForPrint}
                  className={`min-h-11 w-full rounded-full border border-fuchsia-300/70 bg-fuchsia-500/20 px-5 py-2.5 text-sm font-black text-fuchsia-50 hover:bg-fuchsia-400/30 disabled:cursor-not-allowed disabled:opacity-50 ${interactivePressable}`}
                >
                  Print QR Code
                </button>
              </div>
            </div>

          </div>

          <div className="mt-5 rounded-2xl border border-purple-950 bg-[#05070d] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-300">Update Order Status</p>

              {isUpdating && <p className="text-sm text-purple-300">Updating status...</p>}
            </div>

            {isOrderLocked ? (
              <div className="rounded-2xl border border-green-300/40 bg-green-500/10 p-4 text-green-100">
                <p className="font-bold">
                  {isDelivered
                    ? 'Delivered Order Locked'
                    : statusKey === 'returned'
                      ? 'Returned Order Locked'
                      : 'Order Locked'}
                </p>

                <p className="mt-1 text-sm text-green-200">
                  {isDelivered
                    ? 'This order is delivered, so normal status changes are blocked.'
                    : statusKey === 'returned'
                      ? 'This order is marked returned, so normal status changes are blocked.'
                      : 'This order has a return/cancellation exception on file, so normal status changes are blocked. Clear the exception workflow if that is no longer applicable.'}
                </p>

                {hasReturnException ? (
                  <div className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 p-4 text-red-100">
                    <p className="font-bold">Exception Completed</p>
                    <p className="mt-1 text-sm">This order was already cancelled/returned.</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpenReturnModal(order)}
                    className={`mt-4 min-h-12 w-full rounded-full border border-red-300 bg-red-500/20 px-5 py-3 font-bold text-red-100 hover:bg-red-300 hover:text-black sm:w-auto ${interactivePressable}`}
                  >
                    Order was cancelled/returned? Why?
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {ADMIN_ORDER_STATUS_ACTIONS.map((action) => {
                  const primary = adminPrimaryHighlightKey(order.status);
                  const isHighlighted = primary === action.highlightKey;
                  const disabled = isAdminStatusActionDisabled(
                    order.status,
                    action.apiStatus,
                    isUpdating,
                  );
                  return (
                    <button
                      key={action.apiStatus}
                      type="button"
                      disabled={disabled}
                      onClick={() => onUpdateStatus(order.id, action.apiStatus)}
                      className={
                        isHighlighted
                          ? `min-h-13 rounded-2xl border-2 px-4 py-3 text-center text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-100 ${adminStatusActionHighlightClass(action.highlightKey)} ${interactivePressable}`
                          : `min-h-13 rounded-2xl border-2 bg-[#0d0716] px-4 py-3 text-center text-sm font-semibold text-gray-200 shadow-[0_0_18px_rgba(168,85,247,0.12)] hover:border-purple-400/55 hover:bg-purple-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 ${adminStatusActionBorder(action.highlightKey)} ${interactivePressable}`
                      }
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {isCancelled ? (
        <div className="mt-10 rounded-2xl border border-teal-400/45 bg-linear-to-br from-teal-950/40 to-[#0a1620] p-5 shadow-[0_0_28px_rgba(45,212,191,0.12)]">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-teal-200/90">
            Admin recovery
          </p>
          <h3 className="mt-2 text-lg font-bold text-white">
            Mistaken cancellation?
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-gray-300">
            Use uncancel only to restore a real order. Stock must be available again; points are
            not auto-awarded — customers claim after delivery as usual.
          </p>
          <button
            type="button"
            onClick={() => onRequestUncancel(order)}
            disabled={isUpdating}
            className={`mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-teal-300 bg-teal-400/20 px-6 py-3 text-sm font-black text-teal-100 shadow-[0_0_24px_rgba(45,212,191,0.2)] hover:border-teal-200 hover:bg-teal-400/30 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${interactivePressable}`}
          >
            Uncancel Order
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  type = 'default',
}: {
  title: string;
  value: string;
  sub?: string;
  type?: 'default' | 'green' | 'yellow' | 'red';
}) {
  const style =
    type === 'green'
      ? 'border-green-300/30 bg-green-500/10 text-green-300'
      : type === 'yellow'
        ? 'border-yellow-300/30 bg-yellow-500/10 text-yellow-200'
        : type === 'red'
          ? 'border-red-300/30 bg-red-500/10 text-red-300'
          : 'border-purple-950 bg-[#0d0716] text-purple-300';

  return (
    <div className={`rounded-2xl border p-5 ${style}`}>
      <p className="text-sm text-gray-300">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {sub && <p className="mt-1 text-sm text-gray-400">{sub}</p>}
    </div>
  );
}

function AdminOrdersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<Order[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [search, setSearch] = useState('');
  const [mainStatusFilter, setMainStatusFilter] =
    useState<AdminMainOrderFilter>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnLoading, setReturnLoading] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [customerOrdersSearch, setCustomerOrdersSearch] = useState('');
  const [customerViewStatusFilter, setCustomerViewStatusFilter] =
    useState<CustomerViewStatusFilter>('all');
  const [showBusinessSummary, setShowBusinessSummary] = useState(false);
  const [ordersExportPreviewOpen, setOrdersExportPreviewOpen] = useState(false);
  const [receiptPreviewOrder, setReceiptPreviewOrder] = useState<Order | null>(null);
  const [monthKey, setMonthKey] = useState<'all' | string>('all');
  const [uncancelModalOrder, setUncancelModalOrder] = useState<Order | null>(null);
  const [uncancelReasonDraft, setUncancelReasonDraft] = useState('');
  const [uncancelLoading, setUncancelLoading] = useState(false);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{
    tone: 'error' | 'success' | 'info';
    message: string;
  } | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOrderGroup | null>(null);
  /** Deep link (`?orderId=`): brief ring on target order card */
  const [highlightOrderId, setHighlightOrderId] = useState<string | null>(null);
  /** Telegram / shared admin link: order missing or still hidden by filters */
  const [deepLinkMessage, setDeepLinkMessage] = useState<string | null>(null);
  const [deepLinkShowRevealCta, setDeepLinkShowRevealCta] = useState(false);

  const deepLinkRelaxedMainFiltersRef = useRef(false);
  const deepLinkCustomerFiltersResetRef = useRef<string | null>(null);
  const deepLinkScrollDoneRef = useRef<string | null>(null);

  const loading = authLoading || dataLoading;

  useEffect(() => {
    if (!adminFeedback) return;
    const id = window.setTimeout(() => setAdminFeedback(null), 9000);
    return () => window.clearTimeout(id);
  }, [adminFeedback]);

  const customerParamRaw = searchParams.get('customer');
  const orderIdParam = searchParams.get('orderId');

  const parsedCustomerParam = useMemo(() => {
    if (!customerParamRaw) return null;
    try {
      return { key: decodeURIComponent(customerParamRaw), invalid: false };
    } catch {
      return { key: customerParamRaw, invalid: true };
    }
  }, [customerParamRaw]);
  const decodedCustomerKey = parsedCustomerParam?.key ?? null;
  const customerParamInvalid = Boolean(parsedCustomerParam?.invalid);

  async function switchAccount() {
    await supabase.auth.signOut();
    window.location.href = '/auth?redirect=/admin/orders';
  }

  async function loadOrders() {
    setAuthLoading(true);
    setDataLoading(true);
    setLoadError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setUnauthorized(true);
        setOrders([]);
        return;
      }
      setUnauthorized(false);
      setAuthLoading(false);

      const res = await fetch(apiUrl('/admin/orders'), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setUnauthorized(true);
          setLoadError(null);
        } else {
          setUnauthorized(false);
          setLoadError('Could not load admin orders. Please try again.');
        }
        setOrders([]);
        return;
      }

      if (!Array.isArray(data)) {
        setLoadError('Could not load admin orders. Please try again.');
        setOrders([]);
        return;
      }

      setOrders(data);
      setUnauthorized(false);
      setLoadError(null);
    } catch {
      setUnauthorized(false);
      setLoadError('Could not load admin orders. Please check your connection and retry.');
      setOrders([]);
    } finally {
      setAuthLoading(false);
      setDataLoading(false);
    }
  }

  function requestStatusUpdate(orderId: string, status: string) {
    if (status === 'cancelled') {
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        setCancelModalOrder(order);
        setCancelReasonDraft('');
      }
      return;
    }
    void updateStatus(orderId, status);
  }

  async function updateStatus(
    orderId: string,
    status: string,
    cancellationReason?: string,
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setUnauthorized(true);
      return;
    }

    setUpdatingOrderId(orderId);

    try {
      const payload: { status: string; cancellationReason?: string } = { status };
      if (cancellationReason?.trim()) {
        payload.cancellationReason = cancellationReason.trim();
      }

      const res = await fetch(apiUrl(`/admin/orders/${orderId}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setAdminFeedback({
          tone: 'error',
          message: errorData?.message || 'Could not update order status.',
        });
        await loadOrders();
        return;
      }

      const updatedOrder = await res.json();

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? updatedOrder : order)),
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  async function confirmCancelOrder() {
    if (!cancelModalOrder) return;

    const reason = cancelReasonDraft.trim();
    if (reason.length < 5) {
      setAdminFeedback({
        tone: 'info',
        message: 'Please write a cancellation reason of at least 5 characters.',
      });
      return;
    }

    setCancelLoading(true);
    try {
      await updateStatus(cancelModalOrder.id, 'cancelled', reason);
      setCancelModalOrder(null);
      setCancelReasonDraft('');
    } finally {
      setCancelLoading(false);
    }
  }

  async function confirmUncancelOrder() {
    if (!uncancelModalOrder) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setUnauthorized(true);
      return;
    }

    setUncancelLoading(true);

    try {
      const res = await fetch(
        apiUrl(`/admin/orders/${uncancelModalOrder.id}/uncancel`),
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setAdminFeedback({
          tone: 'error',
          message: data?.message || 'Could not uncancel this order.',
        });
        await loadOrders();
        return;
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === uncancelModalOrder.id ? data : order,
        ),
      );
      setUncancelModalOrder(null);
      setUncancelReasonDraft('');
      await loadOrders();
    } finally {
      setUncancelLoading(false);
    }
  }

  async function returnClaimedOrder() {
    if (!returnModalOrder) return;

    if (returnReason.trim().length < 5) {
      setAdminFeedback({
        tone: 'info',
        message: 'Please write a reason of at least 5 characters.',
      });
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setUnauthorized(true);
      return;
    }

    setReturnLoading(true);

    try {
      const res = await fetch(
        apiUrl(`/admin/orders/${returnModalOrder.id}/return-claimed`),
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reason: returnReason.trim(),
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setAdminFeedback({
          tone: 'error',
          message: data?.message || 'Failed to return/cancel order.',
        });
        setReturnModalOrder(null);
        setReturnReason('');
        await loadOrders();
        return;
      }

      setOrders((prev) =>
        prev.map((order) => (order.id === returnModalOrder.id ? data : order)),
      );

      setReturnModalOrder(null);
      setReturnReason('');
      await loadOrders();
    } finally {
      setReturnLoading(false);
    }
  }

  function escapeHtml(value: string) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function printClaimCard(order: Order) {
    const claimNorm = String(order.claim_code ?? '').trim();
    if (!claimNorm) {
      setAdminFeedback({
        tone: 'info',
        message: 'This order has no claim code.',
      });
      return;
    }

    if (order.status === 'cancelled') {
      setAdminFeedback({
        tone: 'info',
        message: 'This order was cancelled. Do not print its QR card.',
      });
      return;
    }

    if (!isSecureOrderClaimCodeForPrint(claimNorm)) {
      setAdminFeedback({
        tone: 'error',
        message:
          'Claim code is missing or not in the secure format. Do not print — fix or regenerate the claim code first.',
      });
      return;
    }

    const qrUrl = siteUrl(`/points?code=${encodeURIComponent(claimNorm)}`);
    const logoAbsoluteUrl = siteUrl('/logo.png');

    let qrRewardDataUrl: string;
    let socialQr: Awaited<ReturnType<typeof generateSocialQrDataUrls>>;
    try {
      const generated = await Promise.all([
        QRCode.toDataURL(qrUrl, { margin: 1, width: 320 }),
        generateSocialQrDataUrls({ width: 200 }),
      ]);
      qrRewardDataUrl = generated[0];
      socialQr = generated[1];
    } catch {
      setAdminFeedback({
        tone: 'error',
        message: 'Could not generate QR images. Try again.',
      });
      return;
    }

    const customerDisplayNameEscaped = escapeHtml(
      String(order.customer_name || 'Guest').trim(),
    );
    const displayClaimEscaped = escapeHtml(claimNorm.toUpperCase());

    const html = buildRewardCardPrintHtml({
      customerDisplayNameEscaped,
      displayClaimEscaped,
      qrRewardDataUrl,
      qrInstagramDataUrl: socialQr.instagram,
      qrTiktokDataUrl: socialQr.tiktok,
      qrFacebookDataUrl: socialQr.facebook,
      logoAbsoluteUrl,
    });

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      setAdminFeedback({
        tone: 'error',
        message: 'Popup blocked. Allow popups for this site and try again.',
      });
      return;
    }

    printWindow.document.write(html);

    printWindow.document.close();
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    orders.forEach((o) => {
      const k = orderMonthKey(o.created_at);
      if (k) keys.add(k);
    });
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  const monthScopedOrders = useMemo(() => {
    if (monthKey === 'all') return orders;
    return orders.filter((o) => orderMonthKey(o.created_at) === monthKey);
  }, [orders, monthKey]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    return monthScopedOrders.filter((order) => {
      const matchesStatus = orderMatchesMainFilter(order, mainStatusFilter);

      const matchesSearch =
        !q ||
        order.customer_name.toLowerCase().includes(q) ||
        order.customer_phone.toLowerCase().includes(q) ||
        (order.customer_email || '').toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.city.toLowerCase().includes(q) ||
        (order.claim_code || '').toLowerCase().includes(q) ||
        (order.return_reason || '').toLowerCase().includes(q) ||
        (order.uncancel_reason || '').toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [monthScopedOrders, search, mainStatusFilter]);

  const groupedCustomers = useMemo((): CustomerOrderGroup[] => {
    const map = new Map<string, Order[]>();
    for (const order of filteredOrders) {
      const k = customerGroupKey(order);
      const list = map.get(k);
      if (list) list.push(order);
      else map.set(k, [order]);
    }

    const groups: CustomerOrderGroup[] = [];

    for (const [key, groupOrders] of map) {
      const ordersSorted = [...groupOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      const latest = ordersSorted[0];
      const totalSpent = ordersSorted.reduce((sum, o) => sum + getAdminOrderTotal(o), 0);
      groups.push({
        key,
        displayName: latest.customer_name,
        phone: latest.customer_phone,
        email: latest.customer_email,
        orders: ordersSorted,
        orderCount: ordersSorted.length,
        totalSpent,
        latestAt: new Date(latest.created_at).getTime(),
        statusCounts: groupFriendlyStatusCountsAll(ordersSorted),
      });
    }

    groups.sort((a, b) => b.latestAt - a.latestAt);
    return groups;
  }, [filteredOrders]);

  const selectedCustomerGroup = useMemo(() => {
    if (!decodedCustomerKey) return null;
    return groupedCustomers.find((g) => g.key === decodedCustomerKey) ?? null;
  }, [groupedCustomers, decodedCustomerKey]);

  useEffect(() => {
    setSelectedCustomer(selectedCustomerGroup);
  }, [selectedCustomerGroup]);

  const selectedCustomerOrders = useMemo(() => {
    if (!selectedCustomerGroup) return [];
    const q = customerOrdersSearch.trim().toLowerCase();
    let list = selectedCustomerGroup.orders.filter((o) =>
      orderMatchesCustomerOrderSearch(o, q),
    );
    if (customerViewStatusFilter !== 'all') {
      list = list.filter((o) =>
        orderMatchesCustomerViewFilter(o, customerViewStatusFilter),
      );
    }
    return list;
  }, [
    selectedCustomerGroup,
    customerOrdersSearch,
    customerViewStatusFilter,
  ]);

  useEffect(() => {
    if (loading) return;
    if (!decodedCustomerKey) return;
    if (searchParams.get('orderId')) return;
    if (!groupedCustomers.some((g) => g.key === decodedCustomerKey)) {
      router.replace('/admin/orders', { scroll: false });
      setExpandedOrderId(null);
    }
  }, [loading, decodedCustomerKey, groupedCustomers, router, searchParams]);

  useEffect(() => {
    deepLinkRelaxedMainFiltersRef.current = false;
    deepLinkCustomerFiltersResetRef.current = null;
    deepLinkScrollDoneRef.current = null;
  }, [orderIdParam]);

  /**
   * Deep link: /admin/orders?orderId=… (e.g. Telegram). Resolves customer, filters, expand, scroll.
   */
  useEffect(() => {
    if (loading) return;

    if (!orderIdParam) {
      setDeepLinkMessage(null);
      setDeepLinkShowRevealCta(false);
      return;
    }

    const target = orders.find((o) => o.id === orderIdParam);
    if (!target) {
      setDeepLinkMessage(
        'Order not found or not visible with current filters.',
      );
      setDeepLinkShowRevealCta(false);
      return;
    }

    const inMainFiltered = filteredOrders.some((o) => o.id === orderIdParam);

    if (!inMainFiltered) {
      if (!deepLinkRelaxedMainFiltersRef.current) {
        setDeepLinkMessage(null);
        setDeepLinkShowRevealCta(false);
        setMonthKey('all');
        setSearch('');
        setMainStatusFilter('all');
        deepLinkRelaxedMainFiltersRef.current = true;
        return;
      }
      setDeepLinkMessage(
        'Order not found or not visible with current filters.',
      );
      setDeepLinkShowRevealCta(true);
      return;
    }

    setDeepLinkMessage(null);
    setDeepLinkShowRevealCta(false);

    const ck = customerGroupKey(target);
    if (decodedCustomerKey !== ck) {
      router.replace(
        `/admin/orders?customer=${encodeURIComponent(ck)}&orderId=${encodeURIComponent(orderIdParam)}`,
        { scroll: false },
      );
      return;
    }

    if (deepLinkCustomerFiltersResetRef.current !== orderIdParam) {
      setCustomerOrdersSearch('');
      setCustomerViewStatusFilter('all');
      deepLinkCustomerFiltersResetRef.current = orderIdParam;
    }

    setExpandedOrderId(orderIdParam);
  }, [
    loading,
    orderIdParam,
    orders,
    filteredOrders,
    decodedCustomerKey,
    router,
  ]);

  useEffect(() => {
    if (!orderIdParam) return;
    if (expandedOrderId !== orderIdParam) return;
    if (!selectedCustomerOrders.some((o) => o.id === orderIdParam)) return;
    if (deepLinkScrollDoneRef.current === orderIdParam) return;

    deepLinkScrollDoneRef.current = orderIdParam;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`order-${orderIdParam}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setHighlightOrderId(orderIdParam);
      window.setTimeout(() => setHighlightOrderId(null), 3200);
    }, 120);
    return () => window.clearTimeout(t);
  }, [orderIdParam, expandedOrderId, selectedCustomerOrders]);

  useEffect(() => {
    if (searchParams.get('orderId')) return;
    setExpandedOrderId(null);
  }, [decodedCustomerKey, searchParams]);

  useEffect(() => {
    if (!expandedOrderId) return;

    const oid = searchParams.get('orderId');
    if (
      oid === expandedOrderId &&
      orders.some((o) => o.id === oid) &&
      !filteredOrders.some((o) => o.id === expandedOrderId)
    ) {
      return;
    }

    if (!filteredOrders.some((o) => o.id === expandedOrderId)) {
      setExpandedOrderId(null);
      return;
    }
    if (
      decodedCustomerKey &&
      selectedCustomerGroup &&
      !selectedCustomerOrders.some((o) => o.id === expandedOrderId)
    ) {
      if (searchParams.get('orderId') === expandedOrderId) return;
      setExpandedOrderId(null);
    }
  }, [
    filteredOrders,
    expandedOrderId,
    decodedCustomerKey,
    selectedCustomerGroup,
    selectedCustomerOrders,
    orders,
    searchParams,
  ]);

  function revealLinkedOrderFromDeepLink() {
    const oid = searchParams.get('orderId');
    if (!oid) return;
    const target = orders.find((o) => o.id === oid);
    deepLinkRelaxedMainFiltersRef.current = false;
    setMonthKey('all');
    setSearch('');
    setMainStatusFilter('all');
    setDeepLinkMessage(null);
    setDeepLinkShowRevealCta(false);
    if (target) {
      const ck = customerGroupKey(target);
      router.replace(
        `/admin/orders?customer=${encodeURIComponent(ck)}&orderId=${encodeURIComponent(oid)}`,
        { scroll: false },
      );
    }
  }

  function backToCustomers() {
    setExpandedOrderId(null);
    setCustomerOrdersSearch('');
    setCustomerViewStatusFilter('all');
    router.push('/admin/orders', { scroll: false });
  }

  function openCustomerOrders(customerKey: string) {
    setExpandedOrderId(null);
    setCustomerOrdersSearch('');
    setCustomerViewStatusFilter('all');
    router.push(`/admin/orders?customer=${encodeURIComponent(customerKey)}`, {
      scroll: false,
    });
  }

  const visibleOrdersForExport = useMemo(() => {
    if (decodedCustomerKey) return selectedCustomerOrders;
    return filteredOrders;
  }, [decodedCustomerKey, selectedCustomerOrders, filteredOrders]);

  const exportFilterSummary = useMemo(() => {
    const statusLabel =
      mainStatusFilter === 'all'
        ? 'All statuses'
        : mainFilterExportLabel(mainStatusFilter);
    const customerViewLabel = decodedCustomerKey
      ? CUSTOMER_VIEW_STATUS_OPTIONS.find((o) => o.id === customerViewStatusFilter)?.label ??
        'All'
      : 'All customers';
    const searchText = decodedCustomerKey ? customerOrdersSearch.trim() : search.trim();
    return {
      monthLabel: formatMonthLabel(monthKey),
      statusFilterLabel: statusLabel,
      customerViewLabel,
      searchText,
    };
  }, [
    monthKey,
    mainStatusFilter,
    decodedCustomerKey,
    customerViewStatusFilter,
    customerOrdersSearch,
    search,
  ]);

  function handleExportOrdersCsv() {
    setOrdersExportPreviewOpen(true);
  }

  function handleExportOrdersPdf() {
    setOrdersExportPreviewOpen(true);
  }

  const stats = useMemo(() => {
    const activeOrders = monthScopedOrders.filter(isNonCancelledOrder);
    const rollups = computeAdminOrderRollups(monthScopedOrders);

    const today = new Date().toDateString();
    const todayOrders = monthScopedOrders.filter(
      (order) => new Date(order.created_at).toDateString() === today,
    );

    const todayRevenue = todayOrders
      .filter(isNonCancelledOrder)
      .reduce((sum, order) => sum + getAdminOrderTotal(order), 0);

    const totalDiscounts = activeOrders.reduce(
      (sum, order) => sum + Number(order.discount_amount || 0),
      0,
    );

    const cityCount: Record<string, number> = {};
    const productCount: Record<string, number> = {};

    activeOrders.forEach((order) => {
      cityCount[order.city] = (cityCount[order.city] || 0) + 1;

      order.order_items?.forEach((item) => {
        productCount[item.product_name] =
          (productCount[item.product_name] || 0) + Number(item.quantity || 0);
      });
    });

    const topCity =
      Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const bestSeller =
      Object.entries(productCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const eventBoothOrdersList = activeOrders.filter(
      (order) => String(order.discount_source || '').toLowerCase() === 'event',
    );
    const eventBoothRevenue = eventBoothOrdersList.reduce(
      (sum, order) => sum + getAdminOrderTotal(order),
      0,
    );
    const eventBoothDiscount = eventBoothOrdersList.reduce(
      (sum, order) => sum + Number(order.discount_amount || 0),
      0,
    );

    return {
      totalOrders: monthScopedOrders.length,
      pending: monthScopedOrders.filter((order) => order.status === 'pending').length,
      confirmed: monthScopedOrders.filter((order) => order.status === 'confirmed').length,
      shipped: monthScopedOrders.filter((order) => order.status === 'shipped').length,
      delivered: monthScopedOrders.filter((order) => order.status === 'delivered')
        .length,
      cancelled: monthScopedOrders.filter((order) => order.status === 'cancelled').length,
      returnedWithPointsReversed: monthScopedOrders.filter(
        (order) => order.points_reversed && Number(order.points_awarded || 0) > 0,
      ).length,
      grossOrderValue: rollups.grossOrderValue,
      paidRevenue: rollups.paidRevenue,
      deliveredRevenue: rollups.deliveredRevenue,
      pendingOrderValue: rollups.pendingOrderValue,
      codUnpaid: rollups.codOutstandingCount,
      codOutstandingValue: rollups.codOutstandingValue,
      failedExpiredPayments: rollups.failedExpiredPaymentsCount,
      averageOrderValue: rollups.avgOrderValue,
      todayOrders: todayOrders.length,
      todayRevenue,
      totalDiscounts,
      topCity,
      bestSeller,
      eventBoothOrders: eventBoothOrdersList.length,
      eventBoothRevenue,
      eventBoothDiscount,
    };
  }, [monthScopedOrders]);

  return (
    <AdminOnly>
      <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] py-5 text-white sm:px-6 sm:py-8 lg:py-10">
        <Navbar />

        {adminFeedback ? (
          <div className="mx-auto mb-5 max-w-6xl">
            <div
              role="alert"
              className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between ${
                adminFeedback.tone === 'error'
                  ? 'border-red-400/40 bg-red-950/40 text-red-100'
                  : adminFeedback.tone === 'success'
                    ? 'border-emerald-400/40 bg-emerald-950/35 text-emerald-50'
                    : 'border-purple-400/35 bg-purple-950/40 text-purple-100'
              }`}
            >
              <p className="min-w-0 flex-1 leading-relaxed">{adminFeedback.message}</p>
              <button
                type="button"
                onClick={() => setAdminFeedback(null)}
                className="shrink-0 rounded-full border border-white/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white/90 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/70"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {deepLinkMessage ? (
          <div className="mx-auto mb-5 max-w-6xl">
            <div
              role="status"
              className="flex flex-col gap-3 rounded-2xl border border-amber-400/35 bg-amber-950/30 px-4 py-3 text-sm text-amber-50 shadow-[0_12px_40px_rgba(0,0,0,0.35)] sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="min-w-0 flex-1 leading-relaxed">{deepLinkMessage}</p>
              {deepLinkShowRevealCta ? (
                <button
                  type="button"
                  onClick={revealLinkedOrderFromDeepLink}
                  className={`shrink-0 rounded-full border border-amber-300/60 bg-amber-500/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-100 hover:bg-amber-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 ${interactivePressable}`}
                >
                  Show linked order
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <section className="mx-auto max-w-6xl">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-red-300">
              Admin Control
            </p>

            <h1 className="mt-3 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
              Admin Orders
            </h1>

            <p className="mt-3 text-sm text-gray-400 sm:text-base">
              Manage order status, customer details, revenue, delivery progress,
              returns, and printable QR reward cards.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <label
                htmlFor="admin-orders-month-filter"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-300 sm:text-xs"
              >
                Period
              </label>
              <select
                id="admin-orders-month-filter"
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value === 'all' ? 'all' : e.target.value)}
                className={`min-h-12 cursor-pointer rounded-full border border-purple-300/55 bg-[#0d0716] px-4 py-2.5 text-xs font-bold text-purple-100 outline-none hover:border-purple-300/80 focus:border-purple-300 sm:text-sm ${interactivePressable}`}
              >
                <option value="all">All Time</option>
                {monthOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatMonthLabel(opt)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleExportOrdersCsv}
                className={`inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300/55 bg-purple-500/15 px-4 py-2.5 text-xs font-bold text-purple-100 hover:border-purple-300/80 hover:bg-purple-500/25 sm:text-sm ${interactivePressable}`}
              >
                Export Orders CSV
              </button>
              <button
                type="button"
                onClick={handleExportOrdersPdf}
                className={`inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300/55 bg-purple-500/15 px-4 py-2.5 text-xs font-bold text-purple-100 hover:border-purple-300/80 hover:bg-purple-500/25 sm:text-sm ${interactivePressable}`}
              >
                Export Orders PDF
              </button>
            </div>
          </div>

          {loading ? (
            <p className="mt-8 text-purple-200">Loading orders...</p>
          ) : unauthorized ? (
            <div className="mx-auto mt-14 max-w-2xl rounded-3xl border border-red-400/40 bg-[#12050a]/90 p-10 text-center shadow-[0_0_70px_rgba(248,113,113,0.18)]">
              <p className="text-sm uppercase tracking-[0.35em] text-red-300">
                Admin Access Required
              </p>

              <h2 className="mt-4 text-4xl font-black text-white">
                You are not an admin
              </h2>

              <p className="mt-4 text-lg text-red-100">
                Please login with an admin account.
              </p>

              <button
                type="button"
                onClick={switchAccount}
                className={`mt-8 rounded-full border border-purple-300 bg-purple-300 px-8 py-4 font-bold text-black hover:bg-white ${interactivePressable}`}
              >
                Switch Account
              </button>
            </div>
          ) : loadError ? (
            <div className="mx-auto mt-14 max-w-2xl rounded-3xl border border-purple-300/40 bg-[#0f0a18] p-10 text-center shadow-[0_0_70px_rgba(168,85,247,0.18)]">
              <p className="text-sm uppercase tracking-[0.35em] text-purple-300">
                Couldn&apos;t Load Orders
              </p>
              <p className="mt-4 text-base text-purple-100">{loadError}</p>
              <button
                type="button"
                onClick={loadOrders}
                className={`mt-8 rounded-full border border-purple-300 bg-purple-300 px-8 py-4 font-bold text-black hover:bg-white ${interactivePressable}`}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {customerParamInvalid ? (
                <div className="mt-6 rounded-2xl border border-amber-300/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  The customer link looked malformed, but we tried to recover it safely.
                </div>
              ) : null}
              <div className="mt-8 rounded-2xl border border-purple-950 bg-[#0d0716]/60 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-purple-300">
                      Business summary and insights
                    </p>
                    <p className="mt-1 max-w-xl text-xs text-gray-500">
                      Collapsed by default so this page stays focused on orders. Charts and deeper
                      breakdowns live on Analytics.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-48 sm:items-end">
                    <Link
                      href="/admin/analytics"
                      className={`inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/10 px-4 py-2.5 text-center text-xs font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/20 sm:text-sm ${interactivePressable}`}
                    >
                      View full analytics
                    </Link>
                    <button
                      type="button"
                      onClick={() => setShowBusinessSummary((v) => !v)}
                      className={`inline-flex min-h-12 items-center justify-center rounded-full border border-purple-300/60 bg-purple-500/15 px-4 py-2.5 text-xs font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/25 sm:text-sm ${interactivePressable}`}
                    >
                      {showBusinessSummary ? 'Hide Business Summary' : 'Show Business Summary'}
                    </button>
                  </div>
                </div>

                {showBusinessSummary && (
                  <>
                    <div className="mt-6">
                      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-purple-300">
                        Business Summary
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard title="Gross Order Value" value={money(stats.grossOrderValue)} type="green" />
                        <StatCard title="Paid Revenue" value={money(stats.paidRevenue)} />
                        <StatCard title="Delivered Order Value" value={money(stats.deliveredRevenue)} />
                        <StatCard title="Pending Order Value" value={money(stats.pendingOrderValue)} type="yellow" />
                        <StatCard title="Avg Order (Gross)" value={money(stats.averageOrderValue)} />
                      </div>
                    </div>

                    <div className="mt-8">
                      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-purple-300">
                        Event QR (Booth)
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                          title="Booth orders"
                          value={String(stats.eventBoothOrders)}
                          type="green"
                        />
                        <StatCard
                          title="Booth revenue"
                          value={money(stats.eventBoothRevenue)}
                        />
                        <StatCard
                          title="Booth discount given"
                          value={money(stats.eventBoothDiscount)}
                        />
                        <StatCard title="Scope" value="This month view" />
                      </div>
                      <p className="mt-3 text-xs text-gray-500">
                        Non-cancelled orders with{' '}
                        <code className="rounded bg-black/30 px-1 text-purple-200">discount_source=event</code>.
                        Campaign funnel and exports:{' '}
                        <Link
                          href="/admin/analytics"
                          className="font-semibold text-purple-300 underline-offset-2 hover:underline"
                        >
                          Analytics → Event QR
                        </Link>
                        .
                      </p>
                    </div>

                    <div className="mt-8">
                      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-purple-300">
                        Order Status
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard title="Total Orders" value={String(stats.totalOrders)} />
                        <StatCard title="Pending" value={String(stats.pending)} type="yellow" />
                        <StatCard title="Confirmed" value={String(stats.confirmed)} />
                        <StatCard title="Delivered" value={String(stats.delivered)} type="green" />
                      </div>
                    </div>

                    <div className="mt-8">
                      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-purple-300">
                        Operations
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard title="Today’s Orders" value={String(stats.todayOrders)} sub={money(stats.todayRevenue)} />
                        <StatCard title="Cancelled" value={String(stats.cancelled)} type="red" />
                        <StatCard title="Returned + Points Reversed" value={String(stats.returnedWithPointsReversed)} type="red" />
                        <StatCard
                          title="COD Outstanding"
                          value={`${stats.codUnpaid} · ${money(stats.codOutstandingValue)}`}
                        />
                        <StatCard
                          title="Failed / Expired"
                          value={String(stats.failedExpiredPayments)}
                        />
                      </div>
                    </div>

                    <div className="mt-8">
                      <p className="mb-4 text-sm uppercase tracking-[0.3em] text-purple-300">
                        Customer Insights
                      </p>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-purple-950 bg-[#0d0716] p-5">
                          <p className="text-sm text-gray-400">Top City</p>
                          <p className="mt-2 text-3xl font-black text-white">
                            {stats.topCity}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-purple-950 bg-[#0d0716] p-5">
                          <p className="text-sm text-gray-400">Best Seller</p>
                          <p className="mt-2 text-3xl font-black text-white">
                            {stats.bestSeller}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {decodedCustomerKey && loading ? (
                <p className="mt-8 text-purple-200">Loading customer orders...</p>
              ) : decodedCustomerKey && !loading && !selectedCustomer ? (
                <PremiumEmptyState
                  className="mt-8"
                  variant="search"
                  compact
                  eyebrow="No results"
                  title="No orders found for this customer."
                  description="Try another customer or adjust your month and search filters."
                  primaryAction={{
                    label: 'Back to Customers',
                    onClick: backToCustomers,
                  }}
                />
              ) : decodedCustomerKey && selectedCustomer ? (
                <>
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={backToCustomers}
                      className={`inline-flex min-h-11 items-center rounded-full border border-purple-300/60 bg-purple-500/10 px-5 py-2.5 text-sm font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/20 ${interactivePressable}`}
                    >
                      ← Back to Customers
                    </button>
                  </div>

                  <div className="mt-6 rounded-2xl border border-purple-950 bg-[#0d0716] p-5 sm:p-6">
                    <h2 className="text-2xl font-black text-white sm:text-3xl">
                      {selectedCustomer.displayName}
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">{selectedCustomer.phone}</p>
                    <p className="text-sm text-gray-500">
                      {selectedCustomer.email || 'No email on file'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                      <p>
                        <span className="text-gray-500">Total orders (visible):</span>{' '}
                        <span className="font-bold text-purple-200">
                          {selectedCustomer.orderCount}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-500">Total spent (visible):</span>{' '}
                        <span className="font-bold text-purple-300">
                          {money(selectedCustomer.totalSpent)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <input
                      value={customerOrdersSearch}
                      onChange={(e) => setCustomerOrdersSearch(e.target.value)}
                      placeholder="Search this customer's orders (ID, address, payment, status...)"
                      className="w-full rounded-2xl border border-purple-950 bg-[#0d0716] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_30px_rgba(168,85,247,0.25)]"
                    />
                  </div>

                  <p className="mt-3 text-xs text-gray-500">
                    Filter by status below. Month and search from the main orders list still
                    control which orders appear for this customer.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {CUSTOMER_VIEW_STATUS_OPTIONS.map((opt) => {
                      const active = customerViewStatusFilter === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCustomerViewStatusFilter(opt.id)}
                          className={`min-h-12 rounded-full border px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                            active
                              ? 'border-purple-300 bg-purple-300/25 text-white shadow-[0_0_22px_rgba(168,85,247,0.35)] ring-2 ring-purple-400/50'
                              : 'border-purple-950 bg-[#0d0716] text-purple-200 hover:border-purple-400/50'
                          } ${interactivePressable}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-4 text-sm text-gray-400">
                    Showing {selectedCustomerOrders.length} order
                    {selectedCustomerOrders.length === 1 ? '' : 's'}
                  </p>

                  <div className="mt-6 grid gap-3 sm:gap-4">
                    {selectedCustomerOrders.length === 0 ? (
                      <PremiumEmptyState
                        compact
                        variant="search"
                        eyebrow="Filtered out"
                        title="No orders match these filters."
                        description="Clear status filters or broaden your search for this customer."
                      />
                    ) : (
                      selectedCustomerOrders.map((order) => {
                        const total = getAdminOrderTotal(order);
                        const isOrderOpen = expandedOrderId === order.id;
                        const isUpdating = updatingOrderId === order.id;
                        const actuallyReversedPoints =
                          Boolean(order.points_reversed) &&
                          Number(order.points_awarded || 0) > 0;

                        return (
                          <div
                            id={`order-${order.id}`}
                            key={order.id}
                            className={`overflow-hidden rounded-xl border border-purple-950/90 bg-[#0d0716] shadow-[0_8px_30px_rgba(168,85,247,0.08)] transition-shadow duration-300 ${
                              highlightOrderId === order.id
                                ? 'ring-2 ring-purple-400/55 shadow-[0_0_32px_rgba(168,85,247,0.45)]'
                                : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOrderId((id) => (id === order.id ? null : order.id))
                              }
                              className={`flex w-full flex-col gap-3 px-3 py-3 text-left sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3 ${
                                isOrderOpen
                                  ? 'border-b border-purple-950/80 bg-[#0f0818]'
                                  : 'bg-[#0d0716]'
                              } hover:bg-[#120a1c] ${interactivePressable}`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-mono text-xs text-gray-400">
                                  {shortenOrderId(order.id)}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                  {new Date(order.created_at).toLocaleString()}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusClass(
                                      order.status,
                                    )}`}
                                  >
                                    {customerOrderStatusLabel(order.status)}
                                  </span>
                                  {order.uncancelled_at ? uncancelledBadge() : null}
                                </div>
                                {actuallyReversedPoints ? (
                                  <p className="mt-1 text-[10px] text-red-200/85">
                                    Points reversed (historical)
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-col gap-1 sm:items-end">
                                <p className="font-black text-purple-300">{money(total)}</p>
                                <p className="text-[11px] text-gray-500">
                                  {adminPaymentStatusLabel(
                                    order.payment_method,
                                    order.payment_status,
                                    order.status,
                                  )}
                                </p>
                                <p className="text-xs font-semibold text-purple-400">
                                  {isOrderOpen ? 'Hide details ▲' : 'View details ▼'}
                                </p>
                              </div>
                            </button>

                            {isOrderOpen && (
                              <div className="bg-[#06040c] px-3 pb-4 pt-1 sm:px-4">
                                <AdminOrderDetailBody
                                  order={order}
                                  isUpdating={isUpdating}
                                  onPrintClaimCard={printClaimCard}
                                  onPreviewReceipt={(o) => setReceiptPreviewOrder(o)}
                                  onUpdateStatus={requestStatusUpdate}
                                  onOpenReturnModal={(o) => {
                                    setReturnModalOrder(o);
                                    setReturnReason('');
                                  }}
                                  onRequestUncancel={(o) => {
                                    setUncancelReasonDraft('');
                                    setUncancelModalOrder(o);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-8">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by customer, phone, email, city, order ID, claim code, or return reason..."
                      className="w-full rounded-2xl border border-purple-950 bg-[#0d0716] px-5 py-4 text-white outline-none placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_30px_rgba(168,85,247,0.25)]"
                    />
                    <div className="mt-4 flex flex-wrap gap-2">
                      {ADMIN_MAIN_FILTER_OPTIONS.map((opt) => {
                        const active = mainStatusFilter === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setMainStatusFilter(opt.id)}
                            className={`min-h-12 rounded-full border px-3.5 py-2.5 text-xs font-bold transition sm:text-sm ${
                              active
                                ? 'border-purple-300 bg-purple-300/25 text-white shadow-[0_0_22px_rgba(168,85,247,0.35)] ring-2 ring-purple-400/50'
                                : 'border-purple-950 bg-[#0d0716] text-purple-200 hover:border-purple-400/50'
                            } ${interactivePressable}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-gray-400">
                    Showing {filteredOrders.length} of {monthScopedOrders.length} orders
                    {filteredOrders.length > 0
                      ? ` · ${groupedCustomers.length} customer${groupedCustomers.length === 1 ? '' : 's'}`
                      : ''}
                  </p>

                  <div className="mt-8 grid gap-4 sm:gap-5">
                    {filteredOrders.length === 0 ? (
                      <PremiumEmptyState
                        compact
                        variant="search"
                        eyebrow="Empty results"
                        title="No orders match your search."
                        description="Try a different keyword, status filter, or month range."
                        secondaryAction={{
                          label: 'Clear search',
                          onClick: () => setSearch(''),
                        }}
                      />
                    ) : (
                      groupedCustomers.map((group) => {
                        const latestDate = new Date(group.latestAt).toLocaleString();
                        const statusSummaryText = group.statusCounts
                          .map(({ label, count }) => `${label}: ${count}`)
                          .join(' · ');

                        return (
                          <div
                            key={group.key}
                            className="rounded-2xl border border-purple-950 bg-[#0d0716] px-4 py-4 shadow-[0_12px_40px_rgba(168,85,247,0.12)] sm:px-6 sm:py-5"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-lg font-bold text-white">{group.displayName}</p>
                                <p className="mt-1 text-sm text-gray-400">{group.phone}</p>
                                <p className="mt-0.5 truncate text-sm text-gray-500">
                                  {group.email || 'No email on file'}
                                </p>
                                <p className="mt-3 text-xs text-gray-400">
                                  <span className="font-semibold text-purple-200">
                                    {group.orderCount}
                                  </span>{' '}
                                  order{group.orderCount === 1 ? '' : 's'} (visible)
                                  {' · '}
                                  <span className="text-gray-500">Latest:</span> {latestDate}
                                </p>
                                <p className="mt-2 text-xs leading-relaxed text-purple-200/90">
                                  {statusSummaryText}
                                </p>
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:flex-col lg:items-stretch lg:text-right">
                                <div className="text-left lg:text-right">
                                  <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                                    Total spent (visible)
                                  </p>
                                  <p className="text-xl font-black text-purple-300 sm:text-2xl">
                                    {money(group.totalSpent)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => openCustomerOrders(group.key)}
                                  className={`min-h-11 w-full rounded-full border border-purple-300/60 bg-purple-500/15 px-5 py-2.5 text-sm font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/25 sm:w-auto lg:min-w-44 ${interactivePressable}`}
                                >
                                  View Customer Orders
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {cancelModalOrder && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-3xl border border-red-300/50 bg-[#12050a] p-5 shadow-[0_0_80px_rgba(248,113,113,0.25)] sm:p-8">
              <p className="text-sm uppercase tracking-[0.35em] text-red-300">
                Cancel order
              </p>
              <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Cancel this order?
              </h2>
              <p className="mt-3 text-sm text-gray-400">
                Stock will be released. The customer will receive a cancellation email with
                your reason.
              </p>
              <div className="mt-5 rounded-2xl border border-purple-950 bg-[#05070d] p-4">
                <p className="font-bold text-white">{cancelModalOrder.customer_name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(cancelModalOrder.created_at).toLocaleString()}
                </p>
              </div>
              <label className="mt-5 block text-sm font-semibold text-purple-200">
                Cancellation reason (sent to customer)
                <textarea
                  value={cancelReasonDraft}
                  onChange={(e) => setCancelReasonDraft(e.target.value)}
                  placeholder="Example: Customer requested cancellation before shipping."
                  rows={4}
                  className="mt-2 w-full rounded-2xl border border-purple-950 bg-[#05070d] p-3 text-white outline-none placeholder:text-gray-500 focus:border-red-300/50"
                />
              </label>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCancelModalOrder(null);
                    setCancelReasonDraft('');
                  }}
                  disabled={cancelLoading}
                  className={`rounded-full border border-purple-400/50 px-6 py-3 font-bold text-purple-100 hover:bg-purple-500/15 disabled:opacity-50 ${interactivePressable}`}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void confirmCancelOrder()}
                  disabled={cancelLoading}
                  className={`rounded-full border border-red-300 bg-red-500/25 px-6 py-3 font-black text-red-50 hover:bg-red-400/40 disabled:opacity-60 ${interactivePressable}`}
                >
                  {cancelLoading ? 'Cancelling…' : 'Confirm cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {uncancelModalOrder && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-teal-400/40 bg-[#0a1418] p-5 shadow-[0_0_80px_rgba(45,212,191,0.2)] sm:p-8">
              <p className="text-sm uppercase tracking-[0.35em] text-teal-300">
                Confirm recovery
              </p>
              <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Uncancel this order?
              </h2>
              <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm leading-relaxed text-amber-100/95 sm:text-base">
                This restores the order and deducts stock again if available. Points are not
                automatically re-awarded.
              </p>
              <div className="mt-5 rounded-2xl border border-purple-950 bg-[#05070d] p-4 text-sm text-gray-300">
                <p className="font-bold text-white">{uncancelModalOrder.customer_name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(uncancelModalOrder.created_at).toLocaleString()}
                </p>
              </div>
              <label className="mt-5 block text-sm font-semibold text-purple-200">
                Optional note (stored as uncancel reason)
                <textarea
                  value={uncancelReasonDraft}
                  onChange={(e) => setUncancelReasonDraft(e.target.value)}
                  placeholder="Leave blank to use the default admin message."
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-purple-950 bg-[#05070d] p-3 text-white outline-none placeholder:text-gray-500 focus:border-teal-400/50"
                />
              </label>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setUncancelModalOrder(null);
                    setUncancelReasonDraft('');
                  }}
                  disabled={uncancelLoading}
                  className={`rounded-full border border-purple-400/50 px-6 py-3 font-bold text-purple-100 hover:bg-purple-500/15 disabled:opacity-50 ${interactivePressable}`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmUncancelOrder}
                  disabled={uncancelLoading}
                  className={`rounded-full border border-teal-300 bg-teal-400/25 px-6 py-3 font-black text-teal-50 hover:bg-teal-400/40 disabled:opacity-60 ${interactivePressable}`}
                >
                  {uncancelLoading ? 'Working…' : 'Confirm Uncancel'}
                </button>
              </div>
            </div>
          </div>
        )}

        {returnModalOrder && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-3xl border border-red-300/50 bg-[#12050a] p-5 shadow-[0_0_80px_rgba(248,113,113,0.25)] sm:p-8">
              <p className="text-sm uppercase tracking-[0.35em] text-red-300">
                Return / Cancellation Exception
              </p>

              <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                Why was this order returned or cancelled?
              </h2>

              <p className="mt-3 text-sm text-gray-400">
                This will cancel the order and return stock. If points were already
                claimed, they will also be reversed.
              </p>

              <div className="mt-5 rounded-2xl border border-purple-950 bg-[#05070d] p-4">
                <p className="text-sm text-gray-400">Order</p>
                <p className="mt-1 font-bold text-white">
                  {returnModalOrder.customer_name}
                </p>
                <p className="mt-1 text-sm text-purple-200">
                  Points to reverse:{' '}
                  {returnModalOrder.points_claimed
                    ? Number(returnModalOrder.points_awarded || 0)
                    : 0}
                </p>
              </div>

              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Example: Customer returned item due to wrong size."
                className="mt-5 min-h-36 w-full rounded-2xl border border-red-300/30 bg-[#05070d] p-4 text-white outline-none placeholder:text-gray-500 focus:border-red-300"
              />

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={returnClaimedOrder}
                  disabled={returnLoading}
                  className={`rounded-full bg-red-300 px-6 py-4 font-black text-black hover:bg-white disabled:opacity-60 ${interactivePressable}`}
                >
                  {returnLoading
                    ? 'Processing...'
                    : returnModalOrder.points_claimed
                      ? 'Confirm Return + Reverse Points'
                      : 'Confirm Return / Cancel Order'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setReturnModalOrder(null);
                    setReturnReason('');
                  }}
                  className={`rounded-full border border-purple-300 px-6 py-4 font-bold text-white hover:bg-purple-300 hover:text-black ${interactivePressable}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <OrdersExportPreview
        open={ordersExportPreviewOpen}
        onClose={() => setOrdersExportPreviewOpen(false)}
        filters={exportFilterSummary}
        rows={visibleOrdersForExport}
        onDownloadPdf={() => {
          downloadOrdersPdf(visibleOrdersForExport, exportFilterSummary);
          setOrdersExportPreviewOpen(false);
        }}
        onDownloadCsv={() => {
          downloadOrdersCsv(visibleOrdersForExport, exportFilterSummary);
          setOrdersExportPreviewOpen(false);
        }}
      />
      <ReceiptPreviewModal
        open={Boolean(receiptPreviewOrder)}
        onClose={() => setReceiptPreviewOrder(null)}
        customerName={receiptPreviewOrder?.customer_name || 'Customer'}
        customerPhone={receiptPreviewOrder?.customer_phone || null}
        customerEmail={receiptPreviewOrder?.customer_email || null}
        addressLine={
          receiptPreviewOrder
            ? `${receiptPreviewOrder.city}, ${receiptPreviewOrder.area}, ${receiptPreviewOrder.street}`
            : null
        }
        paymentMethod={receiptPreviewOrder?.payment_method || ''}
        paymentStatus={receiptPreviewOrder?.payment_status || ''}
        orderStatus={receiptPreviewOrder?.status || ''}
        createdAt={receiptPreviewOrder?.created_at}
        subtotal={Number(receiptPreviewOrder?.subtotal || 0)}
        deliveryFee={Number(receiptPreviewOrder?.delivery_fee || 0)}
        discountAmount={Number(receiptPreviewOrder?.discount_amount || 0)}
        total={receiptPreviewOrder ? getAdminOrderTotal(receiptPreviewOrder) : 0}
        lineItems={(receiptPreviewOrder?.order_items || []).map((it) => ({
          productName: it.product_name,
          color: it.color,
          size: it.size,
          quantity: it.quantity,
          lineTotal: Number(it.total_price || 0),
        }))}
        onDownload={() => {
          if (!receiptPreviewOrder) return;
          downloadAdminReceiptPdf(adminOrderToReceiptPdfPayload(receiptPreviewOrder));
          setReceiptPreviewOrder(null);
        }}
        onPrint={() => {
          if (!receiptPreviewOrder) return;
          printAdminReceiptPdf(adminOrderToReceiptPdfPayload(receiptPreviewOrder));
        }}
      />
    </AdminOnly>
  );
}

function AdminOrdersSuspenseFallback() {
  return (
    <AdminOnly>
      <main className="min-h-screen bg-[#07030d] px-4 py-6 text-white sm:px-6">
        <Navbar />
        <div className="mx-auto max-w-6xl py-10">
          <div className="h-8 w-52 animate-pulse rounded-lg bg-purple-950/60" />
          <div className="mt-8 h-64 animate-pulse rounded-3xl bg-purple-950/40" />
        </div>
      </main>
    </AdminOnly>
  );
}

export default function AdminOrdersPageWithSuspense() {
  return (
    <Suspense fallback={<AdminOrdersSuspenseFallback />}>
      <AdminOrdersPage />
    </Suspense>
  );
}