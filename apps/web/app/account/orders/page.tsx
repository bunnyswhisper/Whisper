'use client';

import { Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import BrandLoader from '@/components/BrandLoader';
import Navbar from '@/components/Navbar';
import { PremiumEmptyState } from '@/components/empty-state';
import { AsyncView, SkeletonOrderList } from '@/components/skeleton';
import { supabase } from '@/lib/supabaseClient';
import { shouldRefetchCustomerDataOnAuthEvent } from '@/lib/authSession';
import {
  CustomerOrdersAuthRequiredError,
  CustomerOrdersFetchError,
  customerOrdersQueryKey,
  customerOrdersStaleTimeMs,
  fetchCustomerOrderById,
  fetchCustomerOrders,
  type CustomerOrder,
} from '@/lib/customerOrders';
import { ORDER_SUCCESS_SYNCED_EVENT } from '@/lib/postOrderSuccessSync';
import { paymentStatusLabel } from '@/lib/paymentDisplay';
import { formatIsoUtcDateShort } from '@/lib/formatIsoDate';
import {
  CUSTOMER_TRACKING_STEPS,
  customerOrderStatusLabel,
  customerTrackingActiveStepIndex,
} from '@/lib/orderStatusDisplay';

function money(value: number) {
  return `EGP ${Number(value || 0).toFixed(2)}`;
}

function shortOrderDate(iso: string) {
  return formatIsoUtcDateShort(iso);
}

function orderItemCount(order: CustomerOrder) {
  return order.order_items.reduce(
    (n, i) => n + Number(i.quantity || 0),
    0,
  );
}

function getOrderTotal(order: CustomerOrder) {
  const subtotal = Number(order.subtotal || 0);
  const delivery = Number(order.delivery_fee ?? subtotal * 0.12);
  const discount = Number(order.discount_amount || 0);
  const vat = Number(order.vat_amount || 0);
  const calculatedTotal = subtotal + delivery + (vat > 0 ? vat : 0) - discount;

  return Number(order.total || 0) > 0
    ? Number(order.total)
    : Math.max(Number(calculatedTotal.toFixed(2)), 0);
}

function statusBadgeClass(status: string) {
  if (status === 'cancelled') return 'border-red-300/40 bg-red-500/15 text-red-200';
  if (status === 'delivered') return 'border-green-300/40 bg-green-500/15 text-green-200';
  if (status === 'shipped') return 'border-blue-300/40 bg-blue-500/15 text-blue-100';
  if (status === 'pending' || status === 'confirmed') {
    return 'border-purple-300/40 bg-purple-500/15 text-purple-100';
  }
  return 'border-yellow-300/40 bg-yellow-500/15 text-yellow-100';
}

function hasIncompleteCardPayment(
  paymentMethod: string | null | undefined,
  paymentStatus: string | null | undefined,
) {
  const method = String(paymentMethod || '').toLowerCase();
  const status = String(paymentStatus || '').toLowerCase();
  return method === 'paymob' && (status === 'failed' || status === 'expired');
}

function StatusTimeline({
  status,
  paymentMethod,
  paymentStatus,
}: {
  status: string;
  paymentMethod: string;
  paymentStatus: string;
}) {
  const activeIndex = customerTrackingActiveStepIndex(status);
  const isCancelled = status === 'cancelled';
  const paymentIncomplete = hasIncompleteCardPayment(paymentMethod, paymentStatus);

  return (
    <div className="mt-5 rounded-2xl border border-purple-950 bg-[#05070d] p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-purple-200">Order Tracking</h3>

        <span
          className={`w-fit rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.15em] ${statusBadgeClass(
            status,
          )}`}
        >
          {customerOrderStatusLabel(status)}
        </span>
      </div>

      {paymentIncomplete ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100 sm:text-base">
          <p>Payment not completed. Tracking will appear after a successful payment.</p>
          <Link
            href="/checkout"
            className="mt-3 inline-flex rounded-full border border-red-200/50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-100 hover:border-red-100 hover:bg-red-400/15"
          >
            Retry payment
          </Link>
        </div>
      ) : isCancelled ? (
        <div className="rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100 sm:text-base">
          This order was cancelled. If this was unexpected, please contact support.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
          {CUSTOMER_TRACKING_STEPS.map((step, index) => {
            const done =
              activeIndex !== null && index <= activeIndex;

            return (
              <div
                key={step.title}
                className={`rounded-2xl border p-4 ${
                  done
                    ? 'border-purple-300 bg-purple-300/15 shadow-[0_0_25px_rgba(168,85,247,0.25)]'
                    : 'border-purple-950 bg-[#0d0716] opacity-60'
                }`}
              >
                <div
                  className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full border font-black ${
                    done
                      ? 'border-purple-300 bg-purple-300 text-black'
                      : 'border-purple-950 bg-[#05070d] text-gray-500'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </div>

                <p className={`font-bold ${done ? 'text-white' : 'text-gray-500'}`}>
                  {step.title}
                </p>

                <p className="mt-1 text-xs text-gray-400">{step.blurb}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomerOrdersPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const trackOrderId = searchParams.get('orderId')?.trim() || null;
  const [authChecking, setAuthChecking] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const ordersEnabled = !authChecking && !authRequired;

  const ordersQuery = useQuery({
    queryKey: [...customerOrdersQueryKey, trackOrderId ?? ''],
    queryFn: async () => {
      const list = await fetchCustomerOrders({ trackOrderId });
      if (trackOrderId && !list.some((o) => o.id === trackOrderId)) {
        const single = await fetchCustomerOrderById(trackOrderId);
        if (single) {
          return [single, ...list];
        }
      }
      return list;
    },
    staleTime: customerOrdersStaleTimeMs,
    enabled: ordersEnabled,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      setAuthRequired(!session);
      setAuthChecking(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!shouldRefetchCustomerDataOnAuthEvent(event)) return;

      void (async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setAuthRequired(!session);

        if (session) {
          await queryClient.invalidateQueries({ queryKey: customerOrdersQueryKey });
        }
      })();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  useEffect(() => {
    if (ordersQuery.error instanceof CustomerOrdersAuthRequiredError) {
      setAuthRequired(true);
    }
  }, [ordersQuery.error]);

  useEffect(() => {
    if (!ordersQuery.isSuccess) return;
    if (trackOrderId && ordersQuery.data?.some((o) => o.id === trackOrderId)) {
      setExpandedOrderId(trackOrderId);
      return;
    }
    setExpandedOrderId(null);
  }, [ordersQuery.data, ordersQuery.isSuccess, trackOrderId]);

  useEffect(() => {
    function onOrderSuccessSynced() {
      void queryClient.invalidateQueries({ queryKey: customerOrdersQueryKey });
      void queryClient.refetchQueries({ queryKey: customerOrdersQueryKey });
    }

    window.addEventListener(ORDER_SUCCESS_SYNCED_EVENT, onOrderSuccessSynced);
    return () =>
      window.removeEventListener(ORDER_SUCCESS_SYNCED_EVENT, onOrderSuccessSynced);
  }, [queryClient]);

  const orders = ordersQuery.data ?? [];
  const loading = ordersEnabled && ordersQuery.isPending && ordersQuery.data === undefined;

  const fetchError =
    ordersQuery.error instanceof CustomerOrdersFetchError
      ? ordersQuery.error.message
      : ordersQuery.isError &&
          !(ordersQuery.error instanceof CustomerOrdersAuthRequiredError)
        ? "We couldn't load your orders right now. Please check your connection and try again."
        : '';

  if (authChecking) {
    return <BrandLoader variant="overlay" message="Checking sign-in…" />;
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07030d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(1.5rem,env(safe-area-inset-bottom))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <Navbar />

      <section className="mx-auto max-w-6xl">
        <p className="text-xs uppercase tracking-[0.25em] text-purple-300 sm:text-sm sm:tracking-[0.35em]">
          Customer Orders
        </p>

        <h1 className="mt-3 bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
          My Orders
        </h1>

        <p className="mt-3 text-sm text-gray-400 sm:text-base">
          Track your Bunny&apos;s Whisper orders from checkout to delivery.
        </p>

        {authRequired ? (
          <PremiumEmptyState
            className="mt-8"
            variant="muted"
            eyebrow="Sign in required"
            title="Login to view your orders"
            description="Your Bunny's Whisper order history is saved to your account."
            primaryAction={{
              label: 'Go to Login',
              href: '/auth?redirect=/account/orders',
            }}
          />
        ) : (
          <AsyncView
            loading={loading}
            skeleton={<SkeletonOrderList count={3} />}
            className="mt-8"
          >
            {fetchError ? (
              <PremiumEmptyState
                variant="error"
                showMark={false}
                eyebrow="Could not load"
                title="Orders unavailable right now"
                description={fetchError}
                primaryAction={{
                  label: 'Retry',
                  onClick: () => {
                    void ordersQuery.refetch();
                  },
                }}
              />
            ) : orders.length === 0 ? (
              <PremiumEmptyState
                eyebrow="No Orders Yet"
                title="Your order history is empty."
                description="Once you place an order, it will appear here with tracking and payment details."
                primaryAction={{ label: 'Shop Collection', href: '/' }}
                secondaryAction={{ label: 'Go to Checkout', href: '/checkout' }}
              />
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
              const subtotal = Number(order.subtotal || 0);
              const delivery = Number(order.delivery_fee ?? subtotal * 0.12);
              const discount = Number(order.discount_amount || 0);
              const paymentIncomplete = hasIncompleteCardPayment(
                order.payment_method,
                order.payment_status,
              );
              const isOpen = expandedOrderId === order.id;
              const itemsTotalQty = orderItemCount(order);
              const payLabel = paymentStatusLabel(
                order.payment_method,
                order.payment_status,
              );
              const orderStatusLabelText = paymentIncomplete
                ? 'Payment not completed'
                : customerOrderStatusLabel(order.status);

              return (
                <div
                  key={order.id}
                  className="min-w-0 rounded-3xl border border-purple-950 bg-[#0d0716] p-4 shadow-[0_18px_60px_rgba(168,85,247,0.18)] sm:p-6"
                >
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-300">
                          {shortOrderDate(order.created_at)}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          {itemsTotalQty} item{itemsTotalQty === 1 ? '' : 's'}
                        </p>
                      </div>

                      <div className="flex min-w-0 flex-col gap-2">
                        <p className="break-words text-sm text-gray-300">
                          <span className="text-gray-500">Payment: </span>
                          {payLabel}
                        </p>
                        <span
                          className={`w-fit max-w-full rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] ${
                            paymentIncomplete
                              ? 'border-red-300/40 bg-red-500/15 text-red-200'
                              : statusBadgeClass(order.status)
                          }`}
                        >
                          {orderStatusLabelText}
                        </span>
                      </div>
                    </div>

                    <div className="flex min-w-0 shrink-0 flex-col items-stretch gap-3 sm:items-end sm:text-right">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
                          Total
                        </p>
                        <p className="text-xl font-black text-purple-300 sm:text-2xl">
                          {money(getOrderTotal(order))}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedOrderId((id) =>
                            id === order.id ? null : order.id,
                          )
                        }
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-purple-300/40 bg-purple-500/10 px-4 py-2.5 text-sm font-bold text-purple-100 transition hover:border-purple-300 hover:bg-purple-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/60 sm:w-auto sm:min-w-[140px]"
                        aria-expanded={isOpen}
                      >
                        {isOpen ? 'Hide details' : 'View details'}
                      </button>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="mt-6 min-w-0 space-y-5 border-t border-purple-950/80 pt-6">
                      <div className="rounded-2xl border border-purple-950 bg-[#05070d] p-4">
                        <h3 className="font-bold text-purple-200">
                          Payment summary
                        </h3>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between gap-4 break-words">
                            <span className="text-gray-400">Subtotal</span>
                            <span className="shrink-0 font-semibold text-purple-200">
                              {money(subtotal)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4 break-words">
                            <span className="text-gray-400">Delivery fee</span>
                            <span className="shrink-0 font-semibold text-purple-200">
                              {money(delivery)}
                            </span>
                          </div>
                          {discount > 0 ? (
                            <div className="flex justify-between gap-4 break-words">
                              <span className="text-green-300">Discount</span>
                              <span className="shrink-0 font-semibold text-green-300">
                                − {money(discount)}
                              </span>
                            </div>
                          ) : null}
                          <div className="border-t border-purple-950 pt-3">
                            <div className="flex justify-between gap-4 break-words">
                              <span className="font-bold text-white">Total</span>
                              <span className="shrink-0 font-black text-purple-300">
                                {money(getOrderTotal(order))}
                              </span>
                            </div>
                          </div>
                          <p className="pt-1 text-sm text-gray-400">{payLabel}</p>
                        </div>
                      </div>

                      <StatusTimeline
                        status={order.status}
                        paymentMethod={order.payment_method}
                        paymentStatus={order.payment_status}
                      />

                      <div className="rounded-2xl border border-purple-950 bg-[#05070d] p-4">
                        <h3 className="font-bold text-purple-200">Items</h3>

                        <div className="mt-3 space-y-2">
                          {order.order_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex min-w-0 flex-col gap-2 rounded-xl border border-purple-950 bg-[#0d0716] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                              <span className="min-w-0 break-words text-gray-300">
                                {item.product_name} / {item.color} / {item.size}{' '}
                                × {item.quantity}
                              </span>

                              <span className="shrink-0 font-bold text-purple-300">
                                {money(Number(item.total_price || 0))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
              </div>
            )}
          </AsyncView>
        )}
      </section>
    </main>
  );
}

export default function CustomerOrdersPage() {
  return (
    <Suspense fallback={<BrandLoader variant="overlay" message="Loading orders…" />}>
      <CustomerOrdersPageContent />
    </Suspense>
  );
}