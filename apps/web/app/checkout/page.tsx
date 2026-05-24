'use client';

import Link from 'next/link';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import BrandLoader from '@/components/BrandLoader';
import Navbar from '@/components/Navbar';
import { apiUrl, siteUrl } from '@/lib/api';
import { customerOrderStatusLabel } from '@/lib/orderStatusDisplay';
import { interactivePressable } from '@/lib/interactivePressable';
import { getFreshSessionToken } from '@/lib/authSession';
import {
  type ReceiptLineItem,
} from '@/lib/receiptPdf';
import { formatIsoDateYmd, formatIsoUtcDateTime } from '@/lib/formatIsoDate';
import { ensureCustomerBootstrap, logAuthDev } from '@/lib/authBootstrap';
import { readCart, writeCart } from '@/lib/cartStorage';
import {
  fetchSavedAddresses,
  saveSavedAddressViaApi,
  stripCountryCodeFromPhone,
} from '@/lib/customerSavedAddresses';
import type { SavedAddress } from '@/lib/savedAddressTypes';
import {
  isCardPaymentMethod,
  isPaymobPaymentConfirmedPaid,
  syncAfterConfirmedOrderSuccess,
  type PostOrderSuccessSource,
} from '@/lib/postOrderSuccessSync';
import {
  boothDiscountAmountEgyp,
  BOOTH_DISCOUNT_STORAGE_KEY,
  clearBoothDiscount,
  loadBoothDiscount,
  resolveEventDeviceKeyForCheckout,
  type BoothDiscountStored,
} from '@/lib/boothDiscount';
import TrustChecklist from '@/components/TrustChecklist';
import { InfoPopover } from '@/components/InfoPopover';
import { VisuallyHidden } from '@/components/a11y/VisuallyHidden';
import { ProductImage } from '@/components/images';
import { productImageAlt } from '@/lib/a11y/productImageAlt';
import { PremiumEmptyState } from '@/components/empty-state';
import { SkeletonCheckout } from '@/components/skeleton';
import { HELP } from '@/lib/helpTips';
import {
  paymentMethodLabel,
  paymentStatusLabel as displayPaymentStatusLabel,
} from '@/lib/paymentDisplay';
import {
  fetchCustomerOrderForPaymobReturn,
  collectPaymobRedirectCallback,
  loadOrderAfterPaymobReturn,
  requestPaymobOrderFinalization,
  type PaymobReturnOrder,
} from '@/lib/paymobOrderReturn';

const SESSION_RETRY_MS = 250;
const SESSION_MAX_ATTEMPTS = 6;
const PAYMOB_RETURN_POLL_MS = 3_000;
const PAYMOB_RETURN_POLL_MAX_MS = 180_000;

type CartItem = {
  productId: string;
  variantId: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
};

type FormErrors = {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  city?: string;
  area?: string;
  street?: string;
  general?: string;
};

type AppliedCoupon = {
  valid: boolean;
  code: string;
  discountPercent: number;
  discountAmount: number;
};

type SavedCoupon = {
  id: string;
  code: string;
  discount_percent: number;
  expires_at?: string | null;
};

const countryCodes = [
  { label: 'Egypt', code: '+20' },
  { label: 'Saudi Arabia', code: '+966' },
  { label: 'UAE', code: '+971' },
  { label: 'Kuwait', code: '+965' },
  { label: 'Qatar', code: '+974' },
  { label: 'Bahrain', code: '+973' },
  { label: 'Oman', code: '+968' },
  { label: 'United Kingdom', code: '+44' },
  { label: 'Canada / United States', code: '+1' },
  { label: 'Germany', code: '+49' },
  { label: 'France', code: '+33' },
  { label: 'Italy', code: '+39' },
  { label: 'Spain', code: '+34' },
  { label: 'Turkey', code: '+90' },
  { label: 'Jordan', code: '+962' },
  { label: 'Lebanon', code: '+961' },
  { label: 'Morocco', code: '+212' },
  { label: 'Algeria', code: '+213' },
  { label: 'Tunisia', code: '+216' },
  { label: 'Sudan', code: '+249' },
  { label: 'Australia', code: '+61' },
  { label: 'Brazil', code: '+55' },
  { label: 'China', code: '+86' },
  { label: 'India', code: '+91' },
  { label: 'Japan', code: '+81' },
  { label: 'Pakistan', code: '+92' },
  { label: 'South Korea', code: '+82' },
];

const egyptianCities = [
  'Cairo',
  'Giza',
  'Alexandria',
  'Dakahlia',
  'Sharqia',
  'Gharbia',
  'Monufia',
  'Qalyubia',
  'Port Said',
  'Suez',
  'Ismailia',
  'Fayoum',
  'Beni Suef',
  'Minya',
  'Assiut',
  'Sohag',
  'Qena',
  'Luxor',
  'Aswan',
  'Red Sea',
  'Matrouh',
  'North Sinai',
  'South Sinai',
];

/** Nest/customers errors return message string | string[] | nested objects */
function extractCheckoutOrderErrorPayload(data: unknown): string {
  if (data == null) return 'Could not complete order.';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);
  const o = data as Record<string, unknown>;
  if (o._parseError === true && typeof o.rawText === 'string') {
    const t = o.rawText.trim();
    if (t.length) return t.slice(0, 600);
  }
  if (typeof o.message === 'string') return o.message;
  if (Array.isArray(o.message)) {
    return o.message.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('. ');
  }
  if (typeof o.error === 'string') return o.error;
  return 'Could not complete order.';
}

function userFacingCheckoutOrderError(raw: string): string {
  const t = raw.trim();
  if (
    t.length > 0 &&
    t.length < 280 &&
    !t.includes('at ') &&
    !/\bsql\b/i.test(t) &&
    !/\bprisma\b/i.test(t)
  ) {
    return t;
  }
  return 'We could not place your order right now. Please try again in a moment.';
}

function mapPaymobReturnOrderToReceipt(order: PaymobReturnOrder) {
  const itemsCount =
    Array.isArray(order.order_items) && order.order_items.length > 0
      ? (order.order_items as { quantity?: number }[]).reduce(
          (sum, row) => sum + Number(row.quantity || 0),
          0,
        )
      : 0;

  const lineItems: ReceiptLineItem[] = (
    (order.order_items as {
      product_name?: string;
      color?: string;
      size?: string;
      quantity?: number;
      total_price?: number;
    }[]) || []
  ).map((it) => ({
    productName: String(it.product_name ?? ''),
    color: String(it.color ?? ''),
    size: String(it.size ?? ''),
    quantity: Number(it.quantity ?? 0),
    lineTotal: Number(it.total_price ?? 0),
  }));

  const itemsSum = lineItems.reduce((s, it) => s + it.lineTotal, 0);
  const subtotal = Number(order.subtotal || 0) || itemsSum;
  const deliveryFee = Number(order.delivery_fee ?? subtotal * 0.12);

  return {
    orderId: String(order.id ?? ''),
    itemsCount,
    lineItems,
    sourceOrderItems: Array.isArray(order.order_items) ? order.order_items : [],
    subtotal,
    deliveryFee,
    discountAmount: Number(order.discount_amount || 0),
    couponCode: (order.coupon_code as string | null) || null,
    total: Number(order.total ?? 0),
    paymentMethod: isCardPaymentMethod(String(order.payment_method ?? ''))
      ? 'paymob'
      : 'cash_on_delivery',
    paymentStatus: String(order.payment_status ?? ''),
    orderStatus: String(order.status ?? ''),
    city: String(order.city ?? ''),
    area: String(order.area ?? ''),
    street: String(order.street ?? ''),
    customerName: String(order.customer_name ?? ''),
    claimCode: (order.claim_code as string | null) || null,
    createdAt: (order.created_at as string | null) || null,
  };
}

export default function CheckoutPageWithSuspense() {
  return (
    <Suspense fallback={<CheckoutSearchParamsFallback />}>
      <CheckoutPage />
    </Suspense>
  );
}

function CheckoutSearchParamsFallback() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#05070d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <section className="mx-auto max-w-6xl">
        <Navbar />
        <div className="mb-8">
          <h1 className="bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            Checkout
          </h1>
          <p className="mt-2 text-sm text-gray-400 sm:text-base">
            Loading…
          </p>
        </div>
        <SkeletonCheckout />
      </section>
    </main>
  );
}

function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [stockPopup, setStockPopup] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash_on_delivery' | 'card'>(
    'cash_on_delivery',
  );

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [addressesLoadError, setAddressesLoadError] = useState('');
  const savedAddressesOwnerRef = useRef<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState('');
  const [saveAddress, setSaveAddress] = useState(true);
  const [receiptData, setReceiptData] = useState<any>(null);

  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [savedCoupons, setSavedCoupons] = useState<SavedCoupon[]>([]);
  const [bestCoupon, setBestCoupon] = useState<SavedCoupon | null>(null);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  const [claimCode, setClaimCode] = useState('');

  /** Always null / none on SSR and first client paint — sync from storage in useEffect (hydration-safe). */
  const [boothDiscount, setBoothDiscount] = useState<BoothDiscountStored | null>(null);
  const [discountMode, setDiscountMode] = useState<'none' | 'booth' | 'coupon'>('none');
  /** False until after mount + storage resync — avoids flashing stale “no booth” UI. */
  const [boothHydrated, setBoothHydrated] = useState(false);

  const [mounted, setMounted] = useState(false);
  /** After first auth/profile load, hide skeleton on TOKEN_REFRESHED so taps aren’t blocked. */
  const checkoutAuthBootstrappedRef = useRef(false);
  const postSuccessSyncedRef = useRef<string | null>(null);
  const receiptSectionRef = useRef<HTMLDivElement | null>(null);
  const receiptScrolledRef = useRef<string | null>(null);
  const [paymobReturnPhase, setPaymobReturnPhase] = useState<
    'idle' | 'verifying' | 'auth_required' | 'not_found' | 'error'
  >('idle');

  const [form, setForm] = useState({
    customerName: '',
    countryCode: '+20',
    customerPhone: '',
    customerEmail: '',
    city: '',
    area: '',
    street: '',
    notes: '',
  });

  async function applyPostSuccessSync(
    source: PostOrderSuccessSource,
    orderId?: string,
  ) {
    const dedupeKey = orderId ? `${source}:${orderId}` : source;
    if (postSuccessSyncedRef.current === dedupeKey) return;
    postSuccessSyncedRef.current = dedupeKey;

    await syncAfterConfirmedOrderSuccess({
      queryClient,
      source,
      orderId,
    });

    setCart([]);
    setAppliedCoupon(null);
    setCouponCode('');
  }

  async function resolveSessionWithRetry(attempts = SESSION_MAX_ATTEMPTS) {
    for (let i = 0; i < attempts; i += 1) {
      const { token } = await getFreshSessionToken();
      if (token) {
        const {
          data: { user },
        } = await supabase.auth.getUser(token);
        if (user) return { token, user };
      }
      await new Promise((r) => setTimeout(r, SESSION_RETRY_MS));
    }
    return { token: null as string | null, user: null as any };
  }

  async function loadSavedCoupons() {
    setLoadingCoupons(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const res = await fetch(apiUrl('/points/me'), {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        const coupons = data.coupons || [];
        setSavedCoupons(coupons);

        if (coupons.length > 0) {
          const best = coupons.reduce((prev: any, current: any) =>
            current.discount_percent > prev.discount_percent ? current : prev,
          );

          setBestCoupon(best);
        }
      }
    } finally {
      setLoadingCoupons(false);
    }
  }

  async function loadSavedAddresses(userId: string, accessToken: string) {
    if (
      savedAddressesOwnerRef.current &&
      savedAddressesOwnerRef.current !== userId
    ) {
      setSavedAddresses([]);
    }
    savedAddressesOwnerRef.current = userId;

    setLoadingAddresses(true);
    setAddressesLoadError('');

    try {
      const { addresses, loadFailed } = await fetchSavedAddresses(accessToken);
      if (loadFailed) {
        setSavedAddresses([]);
        setAddressesLoadError(
          'Could not load saved addresses. Please refresh or retry.',
        );
        return;
      }
      setSavedAddresses(addresses);
    } finally {
      setLoadingAddresses(false);
    }
  }

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    function pullBoothFromStorage(): BoothDiscountStored | null {
      const b = loadBoothDiscount();
      setBoothDiscount(b);
      setDiscountMode((prev) => (prev === 'none' && b ? 'booth' : prev));
      return b;
    }

    pullBoothFromStorage();

    function onStorage(e: StorageEvent) {
      if (e.key != null && e.key !== BOOTH_DISCOUNT_STORAGE_KEY) return;
      pullBoothFromStorage();
    }

    function onFocus() {
      pullBoothFromStorage();
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') pullBoothFromStorage();
    }

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    setBoothHydrated(true);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [mounted]);

  /** Booth cleared from storage while UI still in booth mode (tabs / external clears). */
  useEffect(() => {
    if (discountMode !== 'booth') return;
    if (boothDiscount) return;
    setDiscountMode(appliedCoupon ? 'coupon' : 'none');
  }, [boothDiscount, discountMode, appliedCoupon]);

  const orderIdFromUrl = searchParams.get('orderId');
  const paymobReturnPath = orderIdFromUrl
    ? `/checkout?orderId=${encodeURIComponent(orderIdFromUrl)}`
    : null;

  useEffect(() => {
    if (!mounted) return;

    async function checkAuthAndLoadProfile() {
      const showBlockingLoader = !checkoutAuthBootstrappedRef.current;
      if (showBlockingLoader) setAuthLoading(true);
      setProfileLoadError('');
      try {
        const { token, user } = await resolveSessionWithRetry();
        if (!token || !user) {
          savedAddressesOwnerRef.current = null;
          setSavedAddresses([]);
          if (paymobReturnPath) {
            return;
          }
          router.push('/auth?redirect=/checkout');
          return;
        }

        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const authEmail = user.email?.trim().toLowerCase() || '';

        await ensureCustomerBootstrap(supabase, user, {
          phone: profile?.phone || undefined,
          countryCode: profile?.country_code || form.countryCode,
        });

        setForm((prev) => ({
          ...prev,
          customerName:
            profile?.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            prev.customerName,
          customerEmail: authEmail || profile?.email || prev.customerEmail,
          countryCode: profile?.country_code || prev.countryCode,
          customerPhone: profile?.phone
            ? profile.phone.replace(profile?.country_code || '+20', '')
            : prev.customerPhone,
          city: profile?.city || prev.city,
          area: profile?.area || prev.area,
          street: profile?.street || prev.street,
          notes: profile?.notes || prev.notes,
        }));

        if (!paymobReturnPath) {
          setCart(readCart() as CartItem[]);
        } else {
          setCart([]);
        }
        await loadSavedCoupons();
        await loadSavedAddresses(user.id, token);

        const boothFresh = loadBoothDiscount();
        setBoothDiscount(boothFresh);
        setDiscountMode((prev) =>
          prev === 'none' && boothFresh ? 'booth' : prev,
        );
      } catch {
        setProfileLoadError(
          'Could not load your saved checkout data. Please retry.',
        );
      } finally {
        setAuthLoading(false);
        checkoutAuthBootstrappedRef.current = true;
      }
    }

    checkAuthAndLoadProfile();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuthAndLoadProfile();
    });
    return () => subscription.unsubscribe();
  }, [mounted, router, orderIdFromUrl, paymobReturnPath]);

  useEffect(() => {
    if (!mounted || !orderIdFromUrl) {
      setPaymobReturnPhase('idle');
      return;
    }

    const orderIdParam = orderIdFromUrl;
    let cancelled = false;

    async function loadOrderFromServer() {
      setPaymobReturnPhase('verifying');
      setErrors({});
      setSuccess('');

      const redirectCallback = collectPaymobRedirectCallback(searchParams);
      const result = await loadOrderAfterPaymobReturn(
        orderIdParam,
        redirectCallback,
      );
      if (cancelled) return;

      if (!result.ok) {
        setAuthLoading(false);
        if (result.kind === 'auth') {
          setPaymobReturnPhase('auth_required');
          return;
        }
        if (result.kind === 'not_found') {
          setPaymobReturnPhase('not_found');
          return;
        }
        setPaymobReturnPhase('error');
        setErrors({ general: result.message });
        return;
      }

      setPaymobReturnPhase('idle');
      const receipt = mapPaymobReturnOrderToReceipt(result.order);
      setReceiptData(receipt);
      setSuccess('Here is your receipt.');
      setAuthLoading(false);

      if (isPaymobPaymentConfirmedPaid(receipt.paymentMethod, receipt.paymentStatus)) {
        void applyPostSuccessSync('paymob-paid', receipt.orderId);
      }
    }

    void loadOrderFromServer();

    return () => {
      cancelled = true;
    };
  }, [mounted, orderIdFromUrl, searchParams]);

  useEffect(() => {
    if (!mounted || !orderIdFromUrl || !receiptData) return;
    if (!isCardPaymentMethod(receiptData.paymentMethod)) return;
    if (receiptData.paymentStatus !== 'pending') return;

    const orderIdParam = orderIdFromUrl;
    let cancelled = false;
    const startedAt = Date.now();

    async function pollPaymentStatus() {
      const { token } = await getFreshSessionToken();
      if (!token || cancelled) return;

      const redirectCallback = collectPaymobRedirectCallback(searchParams);
      const finalizeResult = await requestPaymobOrderFinalization(
        orderIdParam,
        token,
        redirectCallback,
      );

      let orderPayload: PaymobReturnOrder | null = null;
      if (
        finalizeResult.ok &&
        finalizeResult.finalized &&
        finalizeResult.order &&
        String(finalizeResult.order.payment_status ?? '').toLowerCase() === 'paid'
      ) {
        orderPayload = finalizeResult.order;
      }

      const result = orderPayload
        ? { ok: true as const, order: orderPayload, status: 200 }
        : await fetchCustomerOrderForPaymobReturn(orderIdParam, token);
      if (cancelled || !result.ok) return;

      const paymentStatus = String(result.order.payment_status ?? '');

      if (paymentStatus === receiptData.paymentStatus) return;

      const nextReceipt = mapPaymobReturnOrderToReceipt(result.order);
      setReceiptData(nextReceipt);

      if (
        isPaymobPaymentConfirmedPaid(nextReceipt.paymentMethod, nextReceipt.paymentStatus) &&
        !isPaymobPaymentConfirmedPaid(
          receiptData.paymentMethod,
          receiptData.paymentStatus,
        )
      ) {
        void applyPostSuccessSync('paymob-paid', orderIdParam);
      }
    }

    const interval = setInterval(() => {
      if (Date.now() - startedAt > PAYMOB_RETURN_POLL_MAX_MS) {
        clearInterval(interval);
        return;
      }
      void pollPaymentStatus();
    }, PAYMOB_RETURN_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    mounted,
    orderIdFromUrl,
    receiptData?.paymentStatus,
    receiptData?.paymentMethod,
    searchParams,
  ]);

  useEffect(() => {
    if (!mounted || !orderIdFromUrl) return;
    if (paymobReturnPhase !== 'auth_required') return;

    const orderIdParam = orderIdFromUrl;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.access_token) return;

      void (async () => {
        setPaymobReturnPhase('verifying');
        const redirectCallback = collectPaymobRedirectCallback(searchParams);
        const result = await loadOrderAfterPaymobReturn(
          orderIdParam,
          redirectCallback,
        );
        if (!result.ok) {
          if (result.kind === 'auth') {
            setPaymobReturnPhase('auth_required');
            return;
          }
          if (result.kind === 'not_found') {
            setPaymobReturnPhase('not_found');
            return;
          }
          setPaymobReturnPhase('error');
          setErrors({ general: result.message });
          return;
        }
        setPaymobReturnPhase('idle');
        const receipt = mapPaymobReturnOrderToReceipt(result.order);
        setReceiptData(receipt);
        setSuccess('Here is your receipt.');
        setAuthLoading(false);

        if (isPaymobPaymentConfirmedPaid(receipt.paymentMethod, receipt.paymentStatus)) {
          void applyPostSuccessSync('paymob-paid', receipt.orderId);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, [mounted, orderIdFromUrl, paymobReturnPhase, searchParams]);

  useEffect(() => {
    if (!receiptData) return;
    if (
      !isPaymobPaymentConfirmedPaid(
        receiptData.paymentMethod,
        receiptData.paymentStatus,
      )
    ) {
      return;
    }
    void applyPostSuccessSync('paymob-paid', receiptData.orderId);
  }, [
    receiptData?.orderId,
    receiptData?.paymentMethod,
    receiptData?.paymentStatus,
  ]);

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const delivery = subtotal * 0.12;

  /** Canonical booth applied state — drives totals, banners, coupons, and warnings together. */
  const hasBoothDiscount =
    discountMode === 'booth' && boothDiscount != null;
  const boothDiscountPercent = hasBoothDiscount
    ? boothDiscount.discountPercent
    : null;

  const boothDiscAmt = hasBoothDiscount
    ? boothDiscountAmountEgyp(
        subtotal,
        delivery,
        boothDiscount.discountPercent,
      )
    : 0;
  const couponDiscAmt =
    discountMode === 'coupon' && appliedCoupon
      ? appliedCoupon.discountAmount
      : 0;
  const discountAmount =
    discountMode === 'booth' ? boothDiscAmt : couponDiscAmt;
  /** Coupon % on subtotal + delivery_fee only; VAT not used (vat_amount stays 0). */
  const total = Math.max(
    0,
    Number((subtotal + delivery - discountAmount).toFixed(2)),
  );

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined, general: undefined }));
  }

  function validateCheckout() {
    const nextErrors: FormErrors = {};
    const phoneOnlyNumbers = /^[0-9]{8,12}$/;
    const emailFormat = /^[^\s@]+@[^\s@]+\.com$/;

    if (!form.customerName.trim()) {
      nextErrors.customerName = 'Full name is required.';
    }

    if (!phoneOnlyNumbers.test(form.customerPhone)) {
      nextErrors.customerPhone = 'Enter 8–12 numbers only.';
    }

    if (form.customerEmail && !emailFormat.test(form.customerEmail)) {
      nextErrors.customerEmail = 'Email must be valid and end with .com';
    }

    if (!form.city) nextErrors.city = 'Choose your city.';
    if (!form.area.trim()) nextErrors.area = 'Area is required.';
    if (!form.street.trim()) {
      nextErrors.street = 'Street / building / apartment is required.';
    }

    return nextErrors;
  }

  async function applyCoupon() {
    setCouponError('');
    setErrors((prev) => ({ ...prev, general: undefined }));

    if (hasBoothDiscount) {
      setCouponError(
        'Booth discounts and coupons can’t be combined. Tap “Use coupon instead” above.',
      );
      return;
    }

    if (!couponCode.trim()) {
      setCouponError('Enter a coupon code first.');
      return;
    }

    if (cart.length === 0) {
      setCouponError('Your cart is empty.');
      return;
    }

    setCouponLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setCouponError('Please login to use a coupon.');
        return;
      }

      const res = await fetch(apiUrl('/points/validate-coupon'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code: couponCode.trim(),
          subtotal,
          deliveryFee: delivery,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAppliedCoupon(null);
        setCouponError(data.message || 'Invalid coupon.');
        return;
      }

      setAppliedCoupon(data);
      setCouponCode(data.code);
      setDiscountMode('coupon');
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError('');
    if (boothDiscount) setDiscountMode('booth');
    else setDiscountMode('none');
  }

  async function saveAddressIfNeeded(userId: string, accessToken: string) {
    if (!saveAddress) return;

    const result = await saveSavedAddressViaApi(
      {
        fullName: form.customerName,
        countryCode: form.countryCode,
        phone: `${form.countryCode}${form.customerPhone}`,
        city: form.city,
        area: form.area,
        street: form.street,
        notes: form.notes || undefined,
        saveAddress: true,
      },
      accessToken,
    );

    if (!result.ok) {
      logAuthDev(
        'saved-address',
        { ok: false, message: result.message },
        'warn',
      );
      return;
    }

    await loadSavedAddresses(userId, accessToken);
  }

  async function submitOrder() {
    setErrors({});
    setSuccess('');
    setClaimCode('');

    if (cart.length === 0) {
      setErrors({ general: 'Your cart is empty.' });
      return;
    }

    const validationErrors = validateCheckout();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.push('/auth?redirect=/checkout');
      return;
    }

    const accessToken = session.access_token;
    const authEmail = session.user.email?.trim().toLowerCase() || '';

    await ensureCustomerBootstrap(supabase, session.user, {
      phone: `${form.countryCode}${form.customerPhone}`,
      countryCode: form.countryCode,
    });

    const useCouponDiscount =
      discountMode === 'coupon' && appliedCoupon?.code;

    const resolvedEventDeviceKey =
      resolveEventDeviceKeyForCheckout(boothDiscount);

    if (discountMode === 'booth' && boothDiscount) {
      const cid = boothDiscount.campaignId?.trim() ?? '';
      const rdk = resolvedEventDeviceKey.trim();
      if (!cid || rdk.length < 8) {
        setErrors({
          general:
            'Booth discount could not be verified. Please scan the booth QR again.',
        });
        return;
      }
    }

    const useEventDiscount =
      discountMode === 'booth' &&
      !!boothDiscount &&
      Boolean(boothDiscount.campaignId?.trim()) &&
      resolvedEventDeviceKey.trim().length >= 8;

    const discountPayload = {
      discountSource: useEventDiscount
        ? 'event'
        : useCouponDiscount
          ? 'coupon'
          : 'none',
      eventCampaignId: useEventDiscount
        ? String(boothDiscount!.campaignId).trim()
        : null,
      eventCampaignCode: useEventDiscount
        ? String(boothDiscount!.code ?? '')
            .trim() || null
        : null,
      eventDiscountPercent:
        useEventDiscount && boothDiscount
          ? boothDiscount.discountPercent
          : null,
      eventDeviceKey: useEventDiscount
        ? resolvedEventDeviceKey.trim()
        : null,
      couponCode: useCouponDiscount ? appliedCoupon!.code : null,
    };

    const orderEndpoint = apiUrl('/orders');

    async function postCheckoutOrder(
      paymentMethodPayload: 'paymob' | 'cash_on_delivery',
    ): Promise<Record<string, unknown>> {
      const orderBody: Record<string, unknown> = {
        ...form,
        customerEmail: authEmail || form.customerEmail?.trim().toLowerCase() || '',
        customerPhone: `${form.countryCode}${form.customerPhone}`,
        items: cart,
        paymentMethod: paymentMethodPayload,
        discountSource: discountPayload.discountSource,
        couponCode: discountPayload.couponCode,
        eventCampaignId: discountPayload.eventCampaignId,
        eventCampaignCode: discountPayload.eventCampaignCode,
        eventDiscountPercent: discountPayload.eventDiscountPercent,
        eventDeviceKey: discountPayload.eventDeviceKey,
      };

      const res = await fetch(orderEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(orderBody),
      });

      const raw = await res.text();
      let data: unknown = {};
      try {
        data = raw.length ? JSON.parse(raw) : {};
      } catch {
        data = {
          _parseError: true,
          rawText: raw.slice(0, 1200),
        };
      }

      if (!res.ok) {
        const msg = extractCheckoutOrderErrorPayload(data);
        throw new Error(msg);
      }

      return data as Record<string, unknown>;
    }

    setLoading(true);

    try {
      if (paymentMethod === 'card') {
        const data = await postCheckoutOrder('paymob');

        await supabase.from('customer_profiles').upsert(
          {
            user_id: session.user.id,
            full_name: form.customerName,
            email: form.customerEmail || session.user.email,
            country_code: form.countryCode,
            phone: `${form.countryCode}${form.customerPhone}`,
            city: form.city,
            area: form.area,
            street: form.street,
            notes: form.notes || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );

        await saveAddressIfNeeded(session.user.id, accessToken);

        if (useEventDiscount) {
          clearBoothDiscount();
          setBoothDiscount(null);
          setDiscountMode('none');
        }

        const orderIdStr = String(
          data.orderId ?? data.order_id ?? '',
        ).trim();

        if (!orderIdStr) {
          throw new Error(
            'Card checkout started but the server did not return an order id. Please try again.',
          );
        }

        router.push(
          `/payment?orderId=${encodeURIComponent(orderIdStr)}`,
        );
        return;
      }

      const data = await postCheckoutOrder('cash_on_delivery');

      await supabase.from('customer_profiles').upsert(
        {
          user_id: session.user.id,
          full_name: form.customerName,
          email: form.customerEmail || session.user.email,
          country_code: form.countryCode,
          phone: `${form.countryCode}${form.customerPhone}`,
          city: form.city,
          area: form.area,
          street: form.street,
          notes: form.notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      await saveAddressIfNeeded(session.user.id, accessToken);

      const orderRow =
        data.order && typeof data.order === 'object'
          ? (data.order as Record<string, unknown>)
          : undefined;

      const orderClaimCode =
        (typeof data.claimCode === 'string' ? data.claimCode : null) ||
        (typeof data.claim_code === 'string' ? data.claim_code : null) ||
        (typeof orderRow?.claim_code === 'string' ? orderRow.claim_code : null) ||
        null;

      if (orderClaimCode) {
        setClaimCode(orderClaimCode);
      }

      const lineItems: ReceiptLineItem[] = cart.map((c) => ({
        productName: c.name,
        color: c.color,
        size: c.size,
        quantity: c.quantity,
        lineTotal: c.price * c.quantity,
      }));

      const createdAtIso =
        (typeof orderRow?.created_at === 'string' ? orderRow.created_at : null) ||
        (typeof data.created_at === 'string' ? data.created_at : null) ||
        new Date().toISOString();

      const codOrderId =
        typeof data.orderId === 'string'
          ? data.orderId
          : typeof data.order_id === 'string'
            ? data.order_id
            : undefined;

      setReceiptData({
        orderId: codOrderId,
        itemsCount: itemCount,
        lineItems,
        subtotal,
        deliveryFee: delivery,
        discountAmount,
        couponCode: useCouponDiscount ? appliedCoupon?.code ?? null : null,
        total: Number(
          typeof data.total === 'number' || typeof data.total === 'string'
            ? data.total
            : total,
        ),
        paymentMethod: 'cash_on_delivery',
        paymentStatus: 'unpaid',
        orderStatus: 'confirmed',
        city: form.city,
        area: form.area,
        street: form.street,
        customerName: form.customerName,
        claimCode: orderClaimCode,
        createdAt: createdAtIso,
      });

      if (useEventDiscount) {
        clearBoothDiscount();
        setBoothDiscount(null);
        setDiscountMode('none');
      }
      void applyPostSuccessSync('cod-placed', codOrderId);
      setSuccess('Order placed successfully.');
    } catch (err: unknown) {
      const safeMessage =
        err instanceof Error ? err.message : String(err ?? 'Unknown error');

      if (safeMessage.toLowerCase().includes('stock')) {
        setStockPopup(safeMessage);
        setTimeout(() => setStockPopup(''), 3000);
        return;
      }

      setErrors({
        general: `Could not place order: ${userFacingCheckoutOrderError(safeMessage)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    'rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)]';

  const selectClass =
    'cursor-pointer rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 font-medium text-purple-100 outline-none transition focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)]';

  const errorClass = 'mt-1 text-sm text-red-300';

  const receiptPaymob = isCardPaymentMethod(receiptData?.paymentMethod);
  const paymentPending =
    receiptPaymob && receiptData?.paymentStatus === 'pending';
  const paymentFailed = receiptData?.paymentStatus === 'failed';
  const paymentExpired = receiptData?.paymentStatus === 'expired';
  const paymentPaid = receiptData?.paymentStatus === 'paid';

  function mapOrderItemsToCartItems(rawItems: any[]): CartItem[] {
    return rawItems
      .map((item) => {
        const quantity = Number(item?.quantity ?? 0);
        const unitPrice = Number(item?.unit_price ?? item?.price ?? 0);
        const fallbackPrice =
          quantity > 0 ? Number(item?.total_price ?? 0) / quantity : 0;
        const price = unitPrice > 0 ? unitPrice : fallbackPrice;
        const productId = String(item?.product_id ?? item?.productId ?? '');
        const variantId = String(item?.variant_id ?? item?.variantId ?? '');
        if (!productId || !variantId || quantity <= 0 || price <= 0) return null;
        return {
          productId,
          variantId,
          name: String(item?.product_name ?? item?.name ?? 'Product'),
          slug: String(item?.product_slug ?? item?.slug ?? ''),
          image: String(item?.product_image ?? item?.image ?? ''),
          price,
          size: String(item?.size ?? ''),
          color: String(item?.color ?? ''),
          quantity,
        } as CartItem;
      })
      .filter((item): item is CartItem => Boolean(item));
  }

  function handleRetryCheckout() {
    const existingCart = readCart() as CartItem[];
    const sourceOrderItems = Array.isArray(receiptData?.sourceOrderItems)
      ? receiptData.sourceOrderItems
      : [];
    const rebuiltCart =
      existingCart.length > 0
        ? existingCart
        : mapOrderItemsToCartItems(sourceOrderItems);
    if (rebuiltCart.length > 0) {
      writeCart(rebuiltCart);
      setCart(rebuiltCart);
    }
    setPaymentMethod('card');
    setErrors({});
    setSuccess('');
    setReceiptData(null);
    receiptScrolledRef.current = null;
    router.push('/checkout?retryPayment=1');
  }

  function paymentStatusLabel() {
    return paymentStatusLabelInternal(receiptData?.paymentMethod, receiptData?.paymentStatus);
  }

  function paymentStatusLabelInternal(method?: string, status?: string) {
    return displayPaymentStatusLabel(method, status);
  }

  function receiptOrderStatusLabel() {
    const raw = receiptData?.orderStatus;
    if (raw == null || raw === '') return '—';
    return customerOrderStatusLabel(String(raw));
  }

  function formatReceiptOrderDate(iso: string | null | undefined) {
    if (!iso) return '—';
    return formatIsoUtcDateTime(iso);
  }

  const isPaymobReturn = Boolean(orderIdFromUrl);
  const showPaymobVerifying =
    isPaymobReturn && paymobReturnPhase === 'verifying' && !success;
  const showPaymobAuthRequired =
    isPaymobReturn && paymobReturnPhase === 'auth_required' && !success;
  const showPaymobNotFound =
    isPaymobReturn && paymobReturnPhase === 'not_found' && !success;
  const paymobAuthRedirect = paymobReturnPath
    ? `/auth?redirect=${encodeURIComponent(paymobReturnPath)}`
    : '/auth?redirect=/checkout';

  useEffect(() => {
    if (!success || !receiptData) return;

    const scrollKey =
      typeof receiptData.orderId === 'string' && receiptData.orderId
        ? receiptData.orderId
        : success;
    if (receiptScrolledRef.current === scrollKey) return;
    receiptScrolledRef.current = scrollKey;

    const scrollToReceipt = () => {
      const el = receiptSectionRef.current;
      if (!el) return;
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      el.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToReceipt);
    });
  }, [success, receiptData?.orderId]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#05070d] px-[max(1rem,env(safe-area-inset-left))] pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] pr-[max(1rem,env(safe-area-inset-right))] pt-5 text-white sm:px-6 sm:py-8 lg:py-10">
      <section className="mx-auto max-w-6xl">
        <Navbar />

        <div className="mb-8">
          <h1 className="bg-linear-to-r from-white via-purple-200 to-fuchsia-500 bg-clip-text text-3xl font-black text-transparent sm:text-4xl">
            Checkout
          </h1>

          <p className="mt-2 text-sm text-gray-400 sm:text-base">
            {showPaymobVerifying
              ? 'Confirming your card payment with our servers…'
              : 'Confirm your delivery details and complete your order securely.'}
          </p>
        </div>

        {showPaymobVerifying ? (
          <div className="rounded-3xl border border-purple-950 bg-[#0b0f1a] p-8 shadow-[0_18px_70px_rgba(168,85,247,0.22)]">
            <BrandLoader
              variant="embedded"
              message="Verifying your payment…"
              className="py-10"
            />
            <p className="mt-4 text-center text-sm text-gray-400">
              Please keep this tab open while we load your order confirmation.
            </p>
          </div>
        ) : showPaymobAuthRequired ? (
          <PremiumEmptyState
            variant="muted"
            eyebrow="Sign in required"
            title="Please sign in to view this order"
            description="Your payment may have completed, but we need your account session to show the confirmation. Sign in with the same email you used at checkout."
            primaryAction={{
              label: 'Sign in',
              href: paymobAuthRedirect,
            }}
            secondaryAction={{
              label: 'My Orders',
              href: '/account/orders',
            }}
          />
        ) : showPaymobNotFound ? (
          <PremiumEmptyState
            variant="error"
            eyebrow="Order lookup"
            title="Order not found"
            description="We could not find an order with this link. If you just paid, wait a moment and refresh, or check My Orders after signing in."
            primaryAction={{
              label: 'My Orders',
              href: '/account/orders',
            }}
            secondaryAction={{
              label: 'Continue shopping',
              href: '/',
            }}
          />
        ) : null}

        {!showPaymobVerifying &&
        !showPaymobAuthRequired &&
        !showPaymobNotFound &&
        success ? (
          <div
            ref={receiptSectionRef}
            id="checkout-order-receipt"
            tabIndex={-1}
            className="scroll-mt-24 rounded-3xl border border-purple-300/50 bg-[#0b0f1a] p-8 shadow-[0_18px_70px_rgba(168,85,247,0.22)] outline-none sm:scroll-mt-28"
          >
            <div>
              <p
                className={`text-sm uppercase tracking-[0.35em] ${
                  paymentFailed || paymentExpired
                    ? 'text-red-300'
                    : paymentPending
                      ? 'text-yellow-300'
                      : 'text-green-300'
                }`}
              >
                {paymentFailed || paymentExpired
                  ? 'Payment Issue'
                  : paymentPending
                    ? 'Order Received'
                    : 'Order Successful'}
              </p>

              <h2 className="mt-2 text-4xl font-black text-white">
                {paymentFailed || paymentExpired
                  ? 'Payment was not completed'
                  : 'Thank You For Your Order'}
              </h2>

              <p className="mt-3 max-w-xl text-gray-400">
                {paymentFailed || paymentExpired
                  ? 'Your card payment session expired or was not completed. No payment was taken.'
                  : paymentPending
                    ? 'We are confirming your card payment. This page shows the latest status from your order—refresh shortly after Paymob finishes processing.'
                    : 'Your purchase has been confirmed and our team is preparing it now.'}
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-purple-950 bg-[#07030d] p-6">
              <div className="rounded-2xl border border-purple-950 bg-[#0b0f1a] p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-purple-300">
                  {paymentFailed || paymentExpired ? 'Attempt Summary' : 'Order Summary'}
                </p>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-4">
                    <span className="shrink-0 text-gray-400">Order date</span>
                    <span className="text-right text-white sm:max-w-[70%]">
                      {formatReceiptOrderDate(receiptData?.createdAt)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Customer</span>
                    <span className="text-right text-white">
                      {receiptData?.customerName}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Items</span>
                    <span className="text-white">{receiptData?.itemsCount}</span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Payment method</span>
                    <span className="text-right text-white">
                      {receiptData?.paymentMethod === 'paymob'
                        ? 'Card payment'
                        : paymentMethodLabel(receiptData?.paymentMethod)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Payment status</span>
                    <span className="text-right text-white">
                      {paymentStatusLabel()}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Address</span>
                    <span className="max-w-[60%] text-right text-white">
                      {receiptData?.street}, {receiptData?.area},{' '}
                      {receiptData?.city}
                    </span>
                  </div>

                  <div className="flex justify-between border-t border-purple-950 pt-3">
                    <span className="text-gray-400">
                      {paymentPaid ? 'Total paid' : paymentFailed || paymentExpired ? 'Total attempted' : 'Order total'}
                    </span>
                    <span className="text-lg font-black text-green-300">
                      EGP {receiptData?.total?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-8 flex flex-col gap-4 md:flex-row">
              {paymentFailed || paymentExpired ? (
                <>
                  <button
                    type="button"
                    onClick={handleRetryCheckout}
                    className={`inline-flex w-full items-center justify-center rounded-full bg-purple-300 px-6 py-4 text-center font-bold text-black hover:bg-white md:w-auto ${interactivePressable}`}
                  >
                    Try Card Payment Again
                  </button>
                  <Link
                    href="/"
                    scroll={false}
                    className={`inline-flex w-full items-center justify-center rounded-full border border-purple-300/55 bg-purple-500/15 px-6 py-4 text-center font-bold text-purple-100 hover:border-purple-300 hover:bg-purple-500/25 md:w-auto ${interactivePressable}`}
                  >
                    Continue Shopping
                  </Link>
                </>
              ) : (
                <Link
                  href={
                    receiptData?.orderId
                      ? `/account/orders?orderId=${encodeURIComponent(receiptData.orderId)}`
                      : '/account/orders'
                  }
                  scroll={false}
                  className={`inline-flex w-full items-center justify-center rounded-full border border-purple-300 px-6 py-4 text-center font-bold text-white hover:bg-purple-300 hover:text-black md:w-auto ${interactivePressable}`}
                >
                  Track Order
                </Link>
              )}

              {!(paymentFailed || paymentExpired) ? (
                <Link
                  href="/"
                  scroll={false}
                  className={`inline-flex w-full items-center justify-center rounded-full bg-purple-300 px-6 py-4 text-center font-bold text-black hover:bg-white md:w-auto ${interactivePressable}`}
                >
                  Continue Shopping
                </Link>
              ) : null}
            </div>
          </div>
        ) : profileLoadError &&
          !showPaymobVerifying &&
          !showPaymobAuthRequired &&
          !showPaymobNotFound ? (
          <PremiumEmptyState
            variant="error"
            showMark={false}
            eyebrow="Checkout unavailable"
            title="We couldn't load checkout"
            description={profileLoadError}
            primaryAction={{
              label: 'Retry',
              onClick: () => window.location.reload(),
            }}
          />
        ) : !mounted || (authLoading && !isPaymobReturn) ? (
          <>
            <div className="mb-6 rounded-2xl border border-purple-950/80 bg-[#0b0f1a] px-4 py-3 text-sm text-gray-300">
              Loading checkout…
            </div>
            <SkeletonCheckout />
          </>
        ) : showPaymobVerifying ||
          showPaymobAuthRequired ||
          showPaymobNotFound ? null : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:gap-8">
            <div className="rounded-3xl border border-purple-950/80 bg-[#0b0f1a] p-4 shadow-[0_18px_50px_rgba(168,85,247,0.15)] sm:p-6">
              <h2 className="text-xl font-bold">Delivery Information</h2>

              <div className="mt-6 grid gap-4">
                {loadingAddresses && (
                  <p className="text-sm text-gray-400">Loading addresses...</p>
                )}

                {addressesLoadError ? (
                  <p className="text-sm text-amber-300">{addressesLoadError}</p>
                ) : null}

                {!loadingAddresses &&
                !addressesLoadError &&
                savedAddresses.length === 0 ? (
                  <PremiumEmptyState
                    compact
                    className="!min-h-0"
                    variant="muted"
                    showMark={false}
                    eyebrow="Saved addresses"
                    title="No saved addresses yet."
                    description="Fill in delivery details below — we'll save them to your account for next time."
                  />
                ) : null}

                {savedAddresses.length > 0 && (
                  <div className="rounded-2xl border border-purple-900 bg-[#05070d] p-4">
                    <p className="mb-3 font-bold text-purple-200">
                      Saved Addresses
                    </p>

                    <div className="space-y-3">
                      {savedAddresses.map((address) => (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() =>
                            setForm({
                              customerName: address.full_name,
                              countryCode: address.country_code,
                              customerPhone: stripCountryCodeFromPhone(
                                address.phone,
                                address.country_code,
                              ),
                              customerEmail: form.customerEmail,
                              city: address.city,
                              area: address.area,
                              street: address.street,
                              notes: address.notes || '',
                            })
                          }
                          className="w-full rounded-xl border border-purple-950 bg-[#0b0f1a] p-4 text-left transition hover:border-purple-300"
                        >
                          <p className="font-bold text-white">{address.label}</p>
                          <p className="mt-1 text-sm text-gray-400">
                            {address.street}, {address.area}, {address.city}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <VisuallyHidden as="label" htmlFor="checkout-customer-name">
                    Full name
                  </VisuallyHidden>
                  <input
                    id="checkout-customer-name"
                    name="customerName"
                    autoComplete="name"
                    placeholder="Full name *"
                    value={form.customerName}
                    onChange={(e) => updateField('customerName', e.target.value)}
                    aria-invalid={Boolean(errors.customerName)}
                    aria-describedby={
                      errors.customerName ? 'checkout-customer-name-error' : undefined
                    }
                    className={`${inputClass} w-full ${
                      errors.customerName ? 'border-red-400' : ''
                    }`}
                  />
                  {errors.customerName && (
                    <p id="checkout-customer-name-error" className={errorClass} role="alert">
                      {errors.customerName}
                    </p>
                  )}
                </div>

                <div className="flex min-w-0 flex-row items-stretch gap-2 sm:gap-3">
                  <div className="relative w-[7.5rem] shrink-0 sm:w-[8.25rem]">
                    <select
                      id="checkout-country-code"
                      name="countryCode"
                      value={form.countryCode}
                      onChange={(e) =>
                        updateField('countryCode', e.target.value)
                      }
                      className={`${selectClass} w-full appearance-none px-2 pr-8 text-sm tabular-nums sm:px-3 sm:pr-10`}
                      aria-label="Country calling code"
                    >
                      {countryCodes.map((country) => (
                        <option
                          key={`${country.code}-${country.label}`}
                          value={country.code}
                          className="bg-[#0b0f1a] text-white"
                        >
                          {country.code} · {country.label}
                        </option>
                      ))}
                    </select>

                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-purple-300 sm:right-4 sm:text-lg">
                      ▾
                    </div>
                  </div>

                  <VisuallyHidden as="label" htmlFor="checkout-customer-phone">
                    Phone number
                  </VisuallyHidden>
                  <input
                    id="checkout-customer-phone"
                    name="customerPhone"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    placeholder="Phone number *"
                    value={form.customerPhone}
                    onChange={(e) =>
                      updateField(
                        'customerPhone',
                        e.target.value.replace(/\D/g, ''),
                      )
                    }
                    aria-invalid={Boolean(errors.customerPhone)}
                    aria-describedby={
                      errors.customerPhone ? 'checkout-customer-phone-error' : undefined
                    }
                    className={`${inputClass} min-w-0 flex-1 ${
                      errors.customerPhone ? 'border-red-400' : ''
                    }`}
                  />
                </div>

                {errors.customerPhone && (
                  <p id="checkout-customer-phone-error" className={errorClass} role="alert">
                    {errors.customerPhone}
                  </p>
                )}

                <div>
                  <VisuallyHidden as="label" htmlFor="checkout-customer-email">
                    Email address
                  </VisuallyHidden>
                  <input
                    id="checkout-customer-email"
                    name="customerEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="Email optional, must end with .com"
                    value={form.customerEmail}
                    onChange={(e) => updateField('customerEmail', e.target.value)}
                    className={`${inputClass} w-full ${
                      errors.customerEmail ? 'border-red-400' : ''
                    }`}
                  />
                  {errors.customerEmail && (
                    <p className={errorClass}>{errors.customerEmail}</p>
                  )}
                </div>

                <div className="relative">
                  <VisuallyHidden as="label" htmlFor="checkout-city">
                    City
                  </VisuallyHidden>
                  <select
                    id="checkout-city"
                    name="city"
                    value={form.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    aria-invalid={Boolean(errors.city)}
                    aria-describedby={errors.city ? 'checkout-city-error' : undefined}
                    className={`${selectClass} w-full appearance-none pr-14 ${
                      errors.city ? 'border-red-400' : ''
                    }`}
                  >
                    <option value="" className="bg-[#0b0f1a] text-gray-400">
                      Choose city *
                    </option>

                    {egyptianCities.map((city) => (
                      <option
                        key={city}
                        value={city}
                        className="bg-[#0b0f1a] text-white"
                      >
                        {city}
                      </option>
                    ))}
                  </select>

                  <div className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl text-purple-300">
                    ▾
                  </div>

                  {errors.city && (
                    <p id="checkout-city-error" className={errorClass} role="alert">
                      {errors.city}
                    </p>
                  )}
                </div>

                <div>
                  <VisuallyHidden as="label" htmlFor="checkout-area">
                    Area
                  </VisuallyHidden>
                  <input
                    id="checkout-area"
                    name="area"
                    autoComplete="address-level2"
                    placeholder="Area *"
                    value={form.area}
                    onChange={(e) => updateField('area', e.target.value)}
                    className={`${inputClass} w-full ${
                      errors.area ? 'border-red-400' : ''
                    }`}
                  />
                  {errors.area && <p className={errorClass}>{errors.area}</p>}
                </div>

                <div>
                  <VisuallyHidden as="label" htmlFor="checkout-street">
                    Street, building, and apartment
                  </VisuallyHidden>
                  <input
                    id="checkout-street"
                    name="street"
                    autoComplete="street-address"
                    placeholder="Street / Building / Apartment *"
                    value={form.street}
                    onChange={(e) => updateField('street', e.target.value)}
                    className={`${inputClass} w-full ${
                      errors.street ? 'border-red-400' : ''
                    }`}
                  />
                  {errors.street && <p className={errorClass}>{errors.street}</p>}
                </div>

                <VisuallyHidden as="label" htmlFor="checkout-notes">
                  Delivery notes
                </VisuallyHidden>
                <textarea
                  id="checkout-notes"
                  name="notes"
                  placeholder="Extra notes optional"
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  className="min-h-28 rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-white outline-none transition placeholder:text-gray-500 focus:border-purple-300 focus:shadow-[0_0_25px_rgba(168,85,247,0.25)]"
                />

                <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3">
                  <input
                    id="checkout-save-address"
                    name="saveAddress"
                    type="checkbox"
                    checked={saveAddress}
                    onChange={(e) => setSaveAddress(e.target.checked)}
                    className="h-4 w-4 accent-purple-400"
                  />

                  <span className="text-sm text-gray-300">
                    Save this address for faster checkout next time
                  </span>
                </label>

                {errors.general?.trim() && (
                  <div className="rounded-xl border border-red-400/60 bg-red-500/10 p-4 text-red-200">
                    {errors.general}
                  </div>
                )}
              </div>
            </div>

            <aside className="pointer-events-auto relative z-10 h-fit rounded-3xl border border-purple-950/80 bg-[#0b0f1a] p-4 shadow-[0_18px_50px_rgba(168,85,247,0.15)] sm:p-6 lg:sticky lg:top-6">
              <h2 className="text-xl font-bold">Order Summary</h2>

              <div className="mt-5 space-y-4">
                {cart.map((item) => (
                  <div key={item.variantId} className="flex gap-3 rounded-2xl border border-purple-950 bg-[#05070d] p-3">
                    {item.image && (
                      <span className="relative block h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                        <ProductImage
                          src={item.image}
                          alt={productImageAlt(null, item.name)}
                          variant="checkout"
                        />
                      </span>
                    )}

                    <div className="flex-1">
                    <p className="line-clamp-2 font-medium">{item.name}</p>
                      <p className="text-sm text-gray-400">
                        {item.color} / {item.size} × {item.quantity}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-bold text-purple-300">
                      EGP {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

                <div className="mt-6 border-t border-purple-950 pt-5">
                <div className="mb-5">
                  {boothDiscount && (
                    <div className="mb-4 rounded-2xl border border-purple-400/35 bg-linear-to-br from-[#1a0f2e]/90 to-[#0a0612] p-4 shadow-[0_12px_40px_rgba(168,85,247,0.12)]">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-purple-300">
                        <span>Booth discount</span>
                        <InfoPopover label="Booth vs coupon">{HELP.boothVsCoupon}</InfoPopover>
                      </div>
                      <p className="mt-2 text-lg font-black text-white">
                        {boothDiscount.discountPercent}% OFF
                      </p>
                      <p className="mt-1 text-sm text-purple-200/90">
                        From: {boothDiscount.name}
                      </p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountMode('booth');
                          setAppliedCoupon(null);
                          setCouponCode('');
                          setCouponError('');
                        }}
                        className={`pointer-events-auto min-h-12 flex-1 touch-manipulation rounded-full px-4 py-3 text-sm font-black transition ${
                            discountMode === 'booth'
                              ? 'bg-purple-300 text-black shadow-[0_0_24px_rgba(168,85,247,0.45)]'
                              : 'border border-purple-400/40 bg-purple-500/10 text-purple-100 hover:border-purple-300'
                          }`}
                        >
                          Use booth discount
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountMode('coupon')}
                          className={`pointer-events-auto min-h-12 flex-1 touch-manipulation rounded-full px-4 py-3 text-sm font-bold transition ${
                            discountMode === 'coupon'
                              ? 'border border-emerald-300/60 bg-emerald-500/15 text-emerald-100'
                              : 'border border-purple-950 bg-[#05070d] text-gray-300 hover:border-purple-400'
                          }`}
                        >
                          Use coupon instead
                        </button>
                      </div>
                      {discountMode === 'booth' ? (
                        <p className="mt-3 text-xs text-gray-500">
                          Booth discounts and coupons can&apos;t be combined.
                        </p>
                      ) : null}
                    </div>
                  )}

                  {bestCoupon && !appliedCoupon && discountMode !== 'booth' && (
                    <div className="mb-4 rounded-2xl border border-green-300/40 bg-green-500/10 p-4">
                      <p className="text-sm font-bold text-green-300">
                        Best Available Coupon
                      </p>

                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <p className="font-black text-white">{bestCoupon.code}</p>
                          <p className="text-sm text-green-200">
                            {bestCoupon.discount_percent}% OFF
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setDiscountMode('coupon');
                            setCouponCode(bestCoupon.code);
                          }}
                          className="pointer-events-auto min-h-12 touch-manipulation rounded-full bg-green-300 px-5 py-3 text-sm font-bold text-black hover:bg-white"
                        >
                          Use Best
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-purple-200">
                    <span>Coupon Code</span>
                    <InfoPopover label="Coupon restrictions">{HELP.couponRestrictions}</InfoPopover>
                  </div>

                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      id="checkout-coupon-code"
                      name="couponCode"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      disabled={!!appliedCoupon || discountMode === 'booth'}
                      placeholder="Enter coupon"
                      className="w-full rounded-xl border border-purple-950 bg-[#05070d] px-4 py-3 text-white outline-none placeholder:text-gray-500 focus:border-purple-300 disabled:opacity-50"
                    />

                    {appliedCoupon ? (
                      <button
                        type="button"
                        onClick={removeCoupon}
                        title="Remove applied coupon"
                        className="pointer-events-auto min-h-12 touch-manipulation rounded-full border border-red-300/40 bg-red-500/10 px-4 font-bold text-red-100 hover:bg-red-300 hover:text-black"
                      >
                        X
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={applyCoupon}
                        disabled={couponLoading || discountMode === 'booth'}
                        title={
                          discountMode === 'booth'
                            ? 'Switch to coupon mode to apply a code'
                            : couponLoading
                              ? 'Applying…'
                              : 'Apply coupon code'
                        }
                        className="pointer-events-auto min-h-12 touch-manipulation rounded-full bg-purple-300 px-5 font-bold text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {couponLoading ? 'Checking coupon…' : 'Apply'}
                      </button>
                    )}
                  </div>

                  {discountMode === 'booth' ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Coupon codes are disabled while booth discount is selected.
                    </p>
                  ) : null}

                  {loadingCoupons ? (
                    <p className="mt-2 text-sm text-gray-400">
                      Loading saved coupons...
                    </p>
                  ) : savedCoupons.length > 0 && !appliedCoupon && discountMode !== 'booth' ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-purple-200">
                        Your Saved Coupons
                      </p>

                      {savedCoupons.map((coupon) => (
                        <button
                          key={coupon.id}
                          type="button"
                          onClick={() => {
                            setDiscountMode('coupon');
                            setCouponCode(coupon.code);
                          }}
                          className="pointer-events-auto w-full touch-manipulation rounded-xl border border-purple-900 bg-[#05070d] px-4 py-3 text-left transition hover:border-purple-300"
                        >
                          <div className="flex justify-between">
                            <span className="font-bold text-white">
                              {coupon.code}
                            </span>

                            <span className="font-bold text-green-300">
                              {coupon.discount_percent}% OFF
                            </span>
                          </div>

                          {coupon.expires_at && (
                            <p className="mt-1 text-xs text-gray-400">
                              Expires:{' '}
                              {formatIsoDateYmd(coupon.expires_at)}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {couponLoading ? (
                    <p className="mt-2 text-sm text-purple-200/90">Checking coupon…</p>
                  ) : null}

                  {couponError && (
                    <p className="mt-2 text-sm text-red-300">{couponError}</p>
                  )}

                  {appliedCoupon && discountMode === 'coupon' && (
                    <div className="mt-3 rounded-2xl border border-green-300/40 bg-green-500/10 p-4">
                      <p className="font-black text-green-300">
                        🎉 Coupon Applied Successfully
                      </p>

                      <p className="mt-1 text-white">
                        {appliedCoupon.discountPercent}% OFF
                      </p>

                      <p className="text-sm text-green-200">
                        You saved EGP {discountAmount.toFixed(2)}
                      </p>
                    </div>
                  )}

                  {hasBoothDiscount ? (
                    <div className="mt-3 rounded-2xl border border-purple-400/40 bg-purple-500/10 p-4">
                      <p className="font-black text-purple-200">
                        Booth discount active
                      </p>
                      <p className="mt-1 text-white">
                        {boothDiscount.discountPercent}% OFF — {boothDiscount.name}
                      </p>
                      <p className="mt-2 text-sm text-purple-200/80">
                        You save EGP {discountAmount.toFixed(2)} on subtotal + delivery.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Items</span>
                    <span className="font-bold text-purple-300">{itemCount}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-300">Subtotal</span>
                    <span className="font-bold text-purple-300">
                      EGP {subtotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-300">Delivery Fee</span>
                    <span className="font-bold text-purple-300">
                      EGP {delivery.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-gray-300">
                      <span>Estimated Delivery</span>
                      <InfoPopover label="Delivery estimate">{HELP.deliveryEstimate}</InfoPopover>
                    </div>
                    <span className="font-bold text-purple-300">2 - 4 Days</span>
                  </div>

                  {(discountMode === 'coupon' && appliedCoupon) ||
                  hasBoothDiscount ? (
                    <div className="flex justify-between">
                      <span
                        className={
                          discountMode === 'booth'
                            ? 'text-purple-200'
                            : 'text-green-300'
                        }
                      >
                        {discountMode === 'booth'
                          ? `Booth (${boothDiscount!.discountPercent}%)`
                          : `Coupon (${appliedCoupon!.discountPercent}%)`}
                      </span>
                      <span
                        className={`font-bold ${
                          discountMode === 'booth'
                            ? 'text-purple-200'
                            : 'text-green-300'
                        }`}
                      >
                        - EGP {discountAmount.toFixed(2)}
                      </span>
                    </div>
                  ) : null}

                  <div className="border-t border-purple-950 pt-3">
                    <div className="flex justify-between text-lg">
                      <span className="font-bold text-white">Total</span>
                      <span className="font-black text-purple-300">
                        EGP {total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-300">
                    <span>Payment Method</span>
                    <InfoPopover label="Payment methods">{HELP.paymentMethod}</InfoPopover>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash_on_delivery')}
                    className={`pointer-events-auto flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-2xl border px-4 py-4 text-left text-base transition ${
                      paymentMethod === 'cash_on_delivery'
                        ? 'border-purple-300 bg-purple-300/15 text-white'
                        : 'border-purple-950 bg-[#05070d] text-gray-300 hover:border-purple-300'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-purple-300">
                      {paymentMethod === 'cash_on_delivery' && (
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-300" />
                      )}
                    </span>
                    <span className="font-semibold">Cash on Delivery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`pointer-events-auto flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-2xl border px-4 py-4 text-left text-base transition ${
                      paymentMethod === 'card'
                        ? 'border-purple-300 bg-purple-300/15 text-white'
                        : 'border-purple-950 bg-[#05070d] text-gray-300 hover:border-purple-300'
                    }`}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-purple-300">
                      {paymentMethod === 'card' && (
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-300" />
                      )}
                    </span>
                    <span className="font-semibold">Credit / Debit Card</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={loading}
                  aria-busy={loading}
                  title={
                    loading
                      ? 'Processing…'
                      : paymentMethod === 'card'
                        ? 'Continue to secure card payment'
                        : 'Place order with cash on delivery'
                  }
                  className={`pointer-events-auto mt-6 min-h-14 w-full touch-manipulation rounded-full border border-purple-300 bg-purple-300 px-6 py-4 font-black text-black hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${interactivePressable}`}
                >
                  {loading
                    ? 'Placing Order...'
                    : paymentMethod === 'card'
                      ? 'Continue to Card Payment'
                      : 'Place Order'}
                </button>

                <TrustChecklist
                  items={[
                    'Secure checkout',
                    '2 - 4 day delivery',
                    'Premium quality',
                    'Safe card payments with Paymob',
                  ]}
                />
              </div>
            </aside>
          </div>
        )}
      </section>
      {stockPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="max-w-xl rounded-3xl border border-red-300/60 bg-[#160711]/95 p-8 text-center shadow-[0_0_70px_rgba(248,113,113,0.35)]">
            <p className="text-sm uppercase tracking-[0.35em] text-red-300">
              Stock Alert
            </p>

            <h2 className="mt-4 text-4xl font-black text-white">
              Stock is not available
            </h2>

            <p className="mt-4 text-lg text-red-100">
              {stockPopup.split('. Available:')[0]}
            </p>

            <p className="mt-5 text-sm text-gray-400">
              This message will close automatically.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
