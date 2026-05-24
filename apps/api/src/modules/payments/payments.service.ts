import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  isPaymobRedirectPaymentFailure,
  isPaymobRedirectPaymentSuccess,
  normalizePaymobRedirectParams,
  verifyPaymobRedirectHmac,
  verifyPaymobTransactionHmac,
} from './paymob-hmac.util';
import { OrderFinalizationService } from '../orders/order-finalization.service';
import { PaymobOrderCleanupService } from '../orders/paymob-order-cleanup.service';
import { assertCustomerOrderOwnership } from '../../common/customer-order-ownership';
import { shortIdForLog } from '../../common/safe-log';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly orderFinalizationService: OrderFinalizationService,
    private readonly paymobOrderCleanupService: PaymobOrderCleanupService,
  ) {}

  private getPaymobApiBase(): string {
    return (
      this.configService.get<string>('PAYMOB_API_BASE') ||
      'https://accept.paymob.com/api'
    ).replace(/\/$/, '');
  }

  private getPaymobVersion(): string {
    return this.configService.get<string>('PAYMOB_API_VERSION') || '1';
  }

  private getSecretKey(): string {
    const key = this.configService.get<string>('PAYMOB_SECRET_KEY');
    if (!key) throw new BadRequestException('Paymob is not configured');
    return key;
  }

  private getIntegrationId(): number {
    const raw =
      this.configService.get<string>('PAYMOB_CARD_INTEGRATION_ID') ||
      '5649958';
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      throw new BadRequestException('Invalid PAYMOB_CARD_INTEGRATION_ID');
    }
    return n;
  }

  private getCurrency(): string {
    return this.configService.get<string>('PAYMOB_CURRENCY') || 'EGP';
  }

  private getCheckoutBaseUrl(): string {
    return (
      this.configService.get<string>('PAYMOB_CHECKOUT_BASE_URL') ||
      'https://accept.paymob.com/unifiedcheckout/payment'
    ).replace(/\/$/, '');
  }

  private getFrontendOrderReturnUrl(orderId: string): string {
    const site =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';
    const base = site.replace(/\/$/, '');
    return `${base}/checkout?orderId=${encodeURIComponent(orderId)}`;
  }

  extractCheckoutUrl(intentionResponse: Record<string, unknown>): string | null {
    if (!intentionResponse) return null;
  
    if (typeof intentionResponse.redirect_url === 'string') {
      return intentionResponse.redirect_url;
    }
  
    if (typeof intentionResponse.checkout_url === 'string') {
      return intentionResponse.checkout_url;
    }
  
    const clientSecret =
      (typeof intentionResponse.client_secret === 'string' &&
        intentionResponse.client_secret) ||
      (typeof intentionResponse.payment_key === 'string' &&
        intentionResponse.payment_key) ||
      null;
  
    if (clientSecret) {
      const publicKey = this.configService.get<string>('PAYMOB_PUBLIC_KEY');
  
      if (!publicKey) {
        throw new BadRequestException('PAYMOB_PUBLIC_KEY is not configured');
      }
  
      return `https://accept.paymob.com/unifiedcheckout/?publicKey=${encodeURIComponent(
        publicKey,
      )}&clientSecret=${encodeURIComponent(clientSecret)}`;
    }
  
    return null;
  }

  private splitName(fullName: string): { first: string; last: string } {
    const parts = (fullName || 'Customer').trim().split(/\s+/);
    const first = parts[0] || 'Customer';
    const last = parts.slice(1).join(' ') || '-';
    return { first, last };
  }

  /**
   * Paymob merchant ref is `${internalOrderId}-${Date.now()}`; recover UUID for DB lookup.
   */
  private extractInternalOrderIdFromPaymobRef(ref: string): string | null {
    const lastDash = ref.lastIndexOf('-');
    if (lastDash <= 0) return null;
    const suffix = ref.slice(lastDash + 1);
    if (!/^\d{12,}$/.test(suffix)) return null;
    const prefix = ref.slice(0, lastDash);
    return prefix.length > 0 ? prefix : null;
  }

  async expireStalePaymobPendingOrders(olderThanMinutes?: number): Promise<{
    scanned: number;
    expired: number;
    finalized: number;
    stockReleased: number;
    legacyReleased: number;
  }> {
    const supabase = this.supabaseService.getClient();
    const forceAllPending = olderThanMinutes === 0;
    const ttl =
      olderThanMinutes != null && olderThanMinutes > 0
        ? olderThanMinutes
        : this.paymobOrderCleanupService.getPendingExpiryMinutes();
    const cutoff = new Date(Date.now() - ttl * 60 * 1000).toISOString();

    let pendingQuery = supabase
      .from('orders')
      .select('id, created_at')
      .eq('payment_method', 'paymob')
      .eq('payment_status', 'pending')
      .eq('status', 'pending');

    if (!forceAllPending) {
      pendingQuery = pendingQuery.lt('created_at', cutoff);
    }

    const { data: pendingOrders, error: findErr } = await pendingQuery;

    if (findErr) {
      throw new BadRequestException(findErr.message);
    }

    let expired = 0;
    let finalized = 0;
    let stockReleased = 0;

    for (const row of pendingOrders || []) {
      const result = await this.reconcilePaymobPendingOrder(String(row.id), {
        expireIfStale: true,
      });
      if (result.action === 'paid') finalized += 1;
      if (result.action === 'expired') expired += 1;
      if (result.stockReleased) stockReleased += 1;
    }

    const { data: legacyOrders, error: legacyErr } = await supabase
      .from('orders')
      .select('id, payment_status')
      .eq('payment_method', 'paymob')
      .in('payment_status', ['failed', 'expired'])
      .eq('status', 'pending');

    if (legacyErr) {
      throw new BadRequestException(legacyErr.message);
    }

    let legacyReleased = 0;
    for (const row of legacyOrders || []) {
      const result =
        await this.paymobOrderCleanupService.releaseUnpaidPaymobOrderInventory(
          String(row.id),
          String(row.payment_status || '').toLowerCase() === 'expired'
            ? 'expired'
            : 'failed',
          {
            paymentFailureReason:
              String(row.payment_status || '').toLowerCase() === 'expired'
                ? 'Payment session expired'
                : 'Payment failed or was cancelled',
          },
        );
      if (result.released) legacyReleased += 1;
      if (result.stockRestored) stockReleased += 1;
    }

    return {
      scanned: (pendingOrders || []).length + (legacyOrders || []).length,
      expired,
      finalized,
      stockReleased,
      legacyReleased,
    };
  }

  async expirePendingPaymobOrders(olderThanMinutes?: number): Promise<{
    scanned: number;
    expired: number;
    finalized: number;
    stockReleased: number;
    legacyReleased: number;
  }> {
    return this.expireStalePaymobPendingOrders(olderThanMinutes);
  }

  /** Poll Paymob for recent pending card orders (handles stuck checkout / missing redirect). */
  @Cron('*/3 * * * *')
  async reconcilePendingPaymobOrdersJob() {
    const supabase = this.supabaseService.getClient();
    const minAge = new Date(Date.now() - 90 * 1000).toISOString();

    try {
      const { data: rows, error } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('payment_method', 'paymob')
        .eq('payment_status', 'pending')
        .eq('status', 'pending')
        .lt('created_at', minAge)
        .order('created_at', { ascending: true })
        .limit(40);

      if (error) {
        throw new BadRequestException(error.message);
      }

      let finalized = 0;
      let expired = 0;

      for (const row of rows || []) {
        const ttlMs =
          this.paymobOrderCleanupService.getPendingExpiryMinutes() * 60 * 1000;
        const createdMs = new Date(String(row.created_at)).getTime();
        const expireIfStale =
          Number.isFinite(createdMs) && Date.now() - createdMs >= ttlMs;

        const result = await this.reconcilePaymobPendingOrder(String(row.id), {
          expireIfStale,
        });
        if (result.action === 'paid') finalized += 1;
        if (result.action === 'expired') expired += 1;
      }

      if (finalized > 0 || expired > 0) {
        this.logger.log(
          `Paymob reconcile job: finalized=${finalized} expired=${expired} scanned=${(rows || []).length}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Paymob reconcile job failed: ${e instanceof Error ? e.message : 'unknown'}`,
      );
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireStalePaymobPendingOrdersJob() {
    try {
      const result = await this.expirePendingPaymobOrders();
      if (
        result.expired > 0 ||
        result.finalized > 0 ||
        result.legacyReleased > 0
      ) {
        this.logger.log(
          `Paymob pending expiry: finalized=${result.finalized} expired=${result.expired} legacyReleased=${result.legacyReleased} stockReleased=${result.stockReleased}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Paymob pending expiry job failed: ${e instanceof Error ? e.message : 'unknown'}`,
      );
    }
  }

  private async paymobPostIntention(
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const base = this.getPaymobApiBase();
    const v = this.getPaymobVersion();
    const url = `${base}/v${v}/intention/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${this.getSecretKey()}`,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      this.logger.warn(
        `Paymob intention JSON parse failed (status ${res.status})`,
      );
      throw new BadRequestException(
        'Payment could not be started. Please try again shortly.',
      );
    }
    if (!res.ok) {
      const msg =
        (data.message as string) ||
        (data.detail as string) ||
        'Paymob intention failed';
      throw new BadRequestException(
        msg.length > 200 ? 'Payment could not be started. Please try again.' : msg,
      );
    }
    return data;
  }

  private async paymobGetIntention(
    reference: string,
  ): Promise<Record<string, unknown>> {
    const base = this.getPaymobApiBase();
    const v = this.getPaymobVersion();
    const url = `${base}/v${v}/intention/${encodeURIComponent(reference)}/`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `token ${this.getSecretKey()}`,
      },
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new BadRequestException('Invalid Paymob retrieve response');
    }
    if (!res.ok) {
      throw new BadRequestException(
        'Payment session could not be retrieved. Please try again.',
      );
    }
    return data;
  }

  async createPaymobIntention(orderId: string, token: string) {
    const supabase = this.supabaseService.getClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user?.email) {
      throw new UnauthorizedException('Invalid customer token');
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      this.logger.warn(`createPaymobIntention order fetch failed`);
      throw new BadRequestException(
        'Could not load your order. Please try again.',
      );
    }

    assertCustomerOrderOwnership(
      this.logger,
      'createPaymobIntention',
      order,
      user,
      orderId,
    );

    const method = String(order.payment_method || '').toLowerCase();
    if (method !== 'paymob' && method !== 'card') {
      throw new BadRequestException('Order is not a Paymob card checkout');
    }

    if (order.payment_status === 'paid') {
      return {
        alreadyPaid: true,
        orderId,
        redirectUrl: this.getFrontendOrderReturnUrl(orderId),
      };
    }

    const total = Number(order.total || 0);
    if (!(total > 0)) {
      throw new BadRequestException('Order total must be greater than zero');
    }

    if (order.payment_status !== 'pending') {
      throw new BadRequestException(
        'Order payment is not pending; refresh your orders page.',
      );
    }

    if (order.paymob_intention_id) {
      try {
        const existing = await this.paymobGetIntention(
          String(order.paymob_intention_id),
        );
        const url = this.extractCheckoutUrl(existing);
        if (url) {
          return { checkoutUrl: url, orderId, reused: true };
        }
      } catch {
        /* fall through to create a new intention */
      }
    }

    const amountCents = Math.round(total * 100);
    const { first, last } = this.splitName(String(order.customer_name || ''));

    const paymobReference = `${orderId}-${Date.now()}`;

    const items = [
      {
        name: `Bunny's Whisper Order ${orderId.slice(0, 8)}`,
        amount: amountCents,
        description: 'Order total including delivery, discounts, and fees',
        quantity: 1,
      },
    ];

    const billing_data = {
      apartment: 'NA',
      email: order.customer_email || user.email || 'na@na.com',
      floor: 'NA',
      first_name: first,
      last_name: last,
      street: String(order.street || 'NA'),
      building: 'NA',
      phone_number: String(order.customer_phone || '').replace(/\s/g, '') || 'NA',
      city: String(order.city || 'NA'),
      country: 'EG',
      state: String(order.area || 'NA'),
      postal_code: 'NA',
    };

    const customer = {
      first_name: first,
      last_name: last,
      email: order.customer_email || user.email,
      phone_number: String(order.customer_phone || '').replace(/\s/g, '') || 'NA',
    };

    const notificationUrl =
      this.configService.get<string>('PAYMOB_WEBHOOK_URL') || null;

    const intentionBody: Record<string, unknown> = {
      amount: amountCents,
      currency: this.getCurrency(),
      payment_methods: [this.getIntegrationId()],
      items,
      billing_data,
      customer,
      delivery_needed: false,
      special_reference: paymobReference,
      merchant_order_id: paymobReference,
    };

    if (notificationUrl) {
      intentionBody.notification_url = notificationUrl;
    }

    intentionBody.redirection_url = this.getFrontendOrderReturnUrl(orderId);

    let paymobRes = await this.paymobPostIntention(intentionBody);
    const checkoutUrl = this.extractCheckoutUrl(paymobRes);

    if (!checkoutUrl) {
      throw new BadRequestException(
        'Paymob did not return a checkout URL; check API credentials and response shape.',
      );
    }

    let intentionId =
      (paymobRes.id as string) ||
      (paymobRes.intention_id as string) ||
      (paymobRes.client_secret as string) ||
      null;

    let paymobOrderNested = paymobRes.order as
      | Record<string, unknown>
      | undefined;
    let paymobOrderId =
      paymobOrderNested && paymobOrderNested.id != null
        ? String(paymobOrderNested.id)
        : paymobRes.intention_order_id != null
          ? String(paymobRes.intention_order_id)
          : null;

    if (!paymobOrderId && intentionId) {
      try {
        const retrieved = await this.paymobGetIntention(intentionId);
        paymobRes = { ...paymobRes, ...retrieved };
        paymobOrderNested = retrieved.order as Record<string, unknown> | undefined;
        if (paymobOrderNested && paymobOrderNested.id != null) {
          paymobOrderId = String(paymobOrderNested.id);
        }
      } catch {
        /* webhook may still resolve via a later callback if Paymob omits order id */
      }
    }

    const { error: updError } = await supabase
      .from('orders')
      .update({
        paymob_intention_id: intentionId,
        paymob_order_id: paymobOrderId,
        payment_raw_response: paymobRes as object,
      })
      .eq('id', orderId);

    if (updError) {
      throw new BadRequestException(updError.message);
    }

    return { checkoutUrl, orderId, reused: false };
  }

  /**
   * Paymob JSON sometimes uses booleans; avoid JS Boolean("false") === true for strings.
   */
  private isPaymobIntentionPaid(intention: Record<string, unknown>): boolean {
    const status = String(
      intention.status ?? intention.payment_status ?? '',
    ).toLowerCase();
    if (
      ['paid', 'succeeded', 'success', 'completed', 'captured', 'confirmed'].includes(
        status,
      )
    ) {
      return true;
    }

    if (status === 'intended' && this.paymobCoerceBooleanFlag(intention.confirmed)) {
      return true;
    }

    if (this.paymobCoerceBooleanFlag(intention.success)) return true;
    if (this.paymobCoerceBooleanFlag(intention.is_paid)) return true;
    if (this.paymobCoerceBooleanFlag(intention.confirmed)) return true;

    const paymentKeys = intention.payment_keys;
    if (Array.isArray(paymentKeys)) {
      for (const pk of paymentKeys) {
        if (pk && typeof pk === 'object') {
          const pkObj = pk as Record<string, unknown>;
          if (this.paymobCoerceBooleanFlag(pkObj.paid)) return true;
        }
      }
    }

    const transactions = intention.transactions;
    if (Array.isArray(transactions)) {
      return transactions.some((t) => {
        if (!t || typeof t !== 'object') return false;
        const tx = t as Record<string, unknown>;
        return (
          this.paymobCoerceBooleanFlag(tx.success) &&
          !this.paymobCoerceBooleanFlag(tx.pending)
        );
      });
    }

    return false;
  }

  private isPaymobIntentionFailed(
    intention: Record<string, unknown>,
  ): boolean {
    const status = String(
      intention.status ?? intention.payment_status ?? '',
    ).toLowerCase();
    if (
      [
        'failed',
        'cancelled',
        'canceled',
        'voided',
        'void',
        'declined',
        'rejected',
        'expired',
      ].includes(status)
    ) {
      return true;
    }

    if (
      this.paymobCoerceBooleanFlag(intention.success) === false &&
      !this.paymobCoerceBooleanFlag(intention.pending)
    ) {
      return true;
    }

    const transactions = intention.transactions;
    if (Array.isArray(transactions)) {
      return transactions.some((t) => {
        if (!t || typeof t !== 'object') return false;
        const tx = t as Record<string, unknown>;
        return (
          this.paymobCoerceBooleanFlag(tx.success) === false &&
          !this.paymobCoerceBooleanFlag(tx.pending)
        );
      });
    }

    return false;
  }

  private extractPaymobTransactionId(
    intention: Record<string, unknown>,
    redirect?: Record<string, string> | null,
  ): string | null {
    if (redirect?.id) return String(redirect.id);
    const transactions = intention.transactions;
    if (Array.isArray(transactions)) {
      for (const t of transactions) {
        if (!t || typeof t !== 'object') continue;
        const tx = t as Record<string, unknown>;
        if (this.paymobCoerceBooleanFlag(tx.success) && tx.id != null) {
          return String(tx.id);
        }
      }
    }
    return null;
  }

  /** Server-side Paymob inquiry using stored intention / order references. */
  private async inquirePaymobPaymentState(
    order: Record<string, unknown>,
  ): Promise<{
    paid: boolean;
    failed: boolean;
    intention?: Record<string, unknown>;
  }> {
    const refs = new Set<string>();
    for (const key of ['paymob_intention_id', 'paymob_order_id'] as const) {
      const value = order[key];
      if (value != null && String(value).trim().length > 0) {
        refs.add(String(value).trim());
      }
    }

    for (const ref of refs) {
      try {
        const intention = await this.paymobGetIntention(ref);
        if (this.isPaymobIntentionPaid(intention)) {
          return { paid: true, failed: false, intention };
        }
        if (this.isPaymobIntentionFailed(intention)) {
          return { paid: false, failed: true, intention };
        }
      } catch (err) {
        this.logger.warn(
          `[inquirePaymob] ref=${shortIdForLog(ref)} failed: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    return { paid: false, failed: false };
  }

  private isPaymobOrderStale(order: Record<string, unknown>): boolean {
    const createdAt = order.created_at;
    if (!createdAt) return false;
    const createdMs = new Date(String(createdAt)).getTime();
    if (!Number.isFinite(createdMs)) return false;
    const ttlMs =
      this.paymobOrderCleanupService.getPendingExpiryMinutes() * 60 * 1000;
    return createdMs < Date.now() - ttlMs;
  }

  /**
   * Verify a pending Paymob order with Paymob, finalize if paid, release stock if failed/expired.
   * Idempotent: paid orders and already-cancelled orders are left unchanged.
   */
  async reconcilePaymobPendingOrder(
    orderId: string,
    options?: {
      expireIfStale?: boolean;
      redirectCallback?: Record<string, string>;
      linkCustomerToken?: string;
    },
  ): Promise<{
    action: 'paid' | 'failed' | 'expired' | 'pending' | 'skipped';
    finalized: boolean;
    newlyFinalized: boolean;
    paymobVerified: boolean;
    stockReleased: boolean;
    paymentStatusAfter: string;
    order: Record<string, unknown> | null;
    verificationSource?: string;
    telegramSent?: boolean;
  }> {
    const supabase = this.supabaseService.getClient();
    const shortOrder = shortIdForLog(orderId);

    if (options?.linkCustomerToken) {
      await this.orderFinalizationService.linkOrderToAuthenticatedCustomer(
        options.linkCustomerToken,
        orderId,
      );
    }

    const { data: order, error: loadErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (loadErr) {
      throw new BadRequestException(loadErr.message);
    }
    if (!order) {
      return {
        action: 'skipped',
        finalized: false,
        newlyFinalized: false,
        paymobVerified: false,
        stockReleased: false,
        paymentStatusAfter: 'unknown',
        order: null,
      };
    }

    const method = String(order.payment_method || '').toLowerCase();
    if (method !== 'paymob' && method !== 'card') {
      return {
        action: 'skipped',
        finalized: false,
        newlyFinalized: false,
        paymobVerified: false,
        stockReleased: false,
        paymentStatusAfter: String(order.payment_status || ''),
        order: order as Record<string, unknown>,
      };
    }

    const paymentStatus = String(order.payment_status || '').toLowerCase();
    if (paymentStatus === 'paid') {
      return {
        action: 'paid',
        finalized: true,
        newlyFinalized: false,
        paymobVerified: true,
        stockReleased: false,
        paymentStatusAfter: 'paid',
        order: order as Record<string, unknown>,
      };
    }

    if (paymentStatus !== 'pending') {
      return {
        action: 'skipped',
        finalized: false,
        newlyFinalized: false,
        paymobVerified: false,
        stockReleased: false,
        paymentStatusAfter: paymentStatus,
        order: order as Record<string, unknown>,
      };
    }

    const normalizedRedirect = options?.redirectCallback
      ? normalizePaymobRedirectParams(options.redirectCallback)
      : null;

    if (normalizedRedirect && Object.keys(normalizedRedirect).length > 0) {
      if (isPaymobRedirectPaymentFailure(normalizedRedirect)) {
        const releaseResult =
          await this.paymobOrderCleanupService.releaseUnpaidPaymobOrderInventory(
            orderId,
            'failed',
            {
              paymentFailureReason:
                String(normalizedRedirect.data_message || '').trim() ||
                'Card payment failed or was cancelled',
            },
          );
        const { data: refreshed } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .maybeSingle();
        return {
          action: 'failed',
          finalized: false,
          newlyFinalized: false,
          paymobVerified: false,
          stockReleased: releaseResult.stockRestored,
          paymentStatusAfter: String(
            refreshed?.payment_status || releaseResult.paymentStatusAfter || 'failed',
          ).toLowerCase(),
          order: (refreshed as Record<string, unknown>) ?? null,
          verificationSource: 'redirect',
        };
      }

      const redirectCheck = this.verifyPaymobRedirectCallback(
        order as Record<string, unknown>,
        normalizedRedirect,
      );
      if (redirectCheck.verified) {
        const paymobTransactionId =
          normalizedRedirect.id != null ? String(normalizedRedirect.id) : null;
        const paymobOrderFromRedirect = normalizedRedirect.order;
        if (paymobOrderFromRedirect) {
          await supabase
            .from('orders')
            .update({ paymob_order_id: String(paymobOrderFromRedirect) })
            .eq('id', orderId);
        }
        const result = await this.orderFinalizationService.finalizePaidOrder(
          orderId,
          'paymob_return',
          {
            paymobTransactionId,
            paymobRaw: {
              redirect: normalizedRedirect,
              source: 'redirect',
            } as object,
          },
        );
        return {
          action: 'paid',
          finalized: true,
          newlyFinalized: result.newlyFinalized,
          paymobVerified: true,
          stockReleased: false,
          paymentStatusAfter: 'paid',
          order: result.order,
          verificationSource: 'redirect',
          telegramSent: result.newlyFinalized && result.telegramSent,
        };
      }
    }

    const inquiry = await this.inquirePaymobPaymentState(
      order as Record<string, unknown>,
    );

    if (inquiry.paid && inquiry.intention) {
      const paymobTransactionId = this.extractPaymobTransactionId(
        inquiry.intention,
        normalizedRedirect,
      );
      const result = await this.orderFinalizationService.finalizePaidOrder(
        orderId,
        'paymob_reconcile',
        {
          paymobTransactionId,
          paymobRaw: {
            intention: inquiry.intention,
            source: 'intention_inquiry',
          } as object,
        },
      );
      this.logger.log(
        `[reconcilePaymob] order=${shortOrder} finalized via Paymob inquiry newlyFinalized=${result.newlyFinalized}`,
      );
      return {
        action: 'paid',
        finalized: true,
        newlyFinalized: result.newlyFinalized,
        paymobVerified: true,
        stockReleased: false,
        paymentStatusAfter: 'paid',
        order: result.order,
        verificationSource: 'intention_inquiry',
        telegramSent: result.newlyFinalized && result.telegramSent,
      };
    }

    if (inquiry.failed) {
      const releaseResult =
        await this.paymobOrderCleanupService.releaseUnpaidPaymobOrderInventory(
          orderId,
          'failed',
          { paymentFailureReason: 'Payment failed or was cancelled' },
        );
      const { data: refreshed } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .maybeSingle();
      return {
        action: 'failed',
        finalized: false,
        newlyFinalized: false,
        paymobVerified: false,
        stockReleased: releaseResult.stockRestored,
        paymentStatusAfter: String(
          refreshed?.payment_status || 'failed',
        ).toLowerCase(),
        order: (refreshed as Record<string, unknown>) ?? null,
        verificationSource: 'intention_inquiry',
      };
    }

    if (options?.expireIfStale && this.isPaymobOrderStale(order)) {
      const releaseResult =
        await this.paymobOrderCleanupService.releaseUnpaidPaymobOrderInventory(
          orderId,
          'expired',
          { paymentFailureReason: 'Payment session expired' },
        );
      const { data: refreshed } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .maybeSingle();
      return {
        action: 'expired',
        finalized: false,
        newlyFinalized: false,
        paymobVerified: false,
        stockReleased: releaseResult.stockRestored,
        paymentStatusAfter: String(
          refreshed?.payment_status || 'expired',
        ).toLowerCase(),
        order: (refreshed as Record<string, unknown>) ?? null,
        verificationSource: 'stale_expiry',
      };
    }

    return {
      action: 'pending',
      finalized: false,
      newlyFinalized: false,
      paymobVerified: false,
      stockReleased: false,
      paymentStatusAfter: 'pending',
      order: order as Record<string, unknown>,
    };
  }

  /**
   * Customer return path: verify Paymob intention when webhook is unavailable, then finalize once.
   */
  private verifyPaymobRedirectCallback(
    order: Record<string, unknown>,
    redirectCallback: Record<string, string>,
  ): { verified: boolean; reason?: string } {
    const params = normalizePaymobRedirectParams(redirectCallback);
    const secret = this.configService.get<string>('PAYMOB_HMAC_SECRET');
    if (!secret) {
      return { verified: false, reason: 'hmac_not_configured' };
    }

    const hmac = params.hmac;
    if (!hmac) {
      return { verified: false, reason: 'missing_hmac' };
    }

    if (!verifyPaymobRedirectHmac(params, hmac, secret)) {
      return { verified: false, reason: 'invalid_hmac' };
    }

    if (!isPaymobRedirectPaymentSuccess(params)) {
      return { verified: false, reason: 'payment_not_successful' };
    }

    const expectedCents = Math.round(Number(order.total) * 100);
    const receivedCents = Number(params.amount_cents);
    if (
      Number.isFinite(expectedCents) &&
      Number.isFinite(receivedCents) &&
      receivedCents !== expectedCents
    ) {
      return { verified: false, reason: 'amount_mismatch' };
    }

    const shortOrder = shortIdForLog(String(order.id ?? ''));
    const currencyRaw = params.currency;
    if (currencyRaw != null && String(currencyRaw).trim() !== '') {
      const receivedCurrency = String(currencyRaw).trim().toUpperCase();
      const expectedCurrency = String(this.getCurrency() || 'EGP').toUpperCase();
      if (receivedCurrency !== expectedCurrency) {
        this.logger.warn(
          `[verifyPaymobRedirect] order=${shortOrder} currency_mismatch received=${receivedCurrency} expected=${expectedCurrency}`,
        );
        return { verified: false, reason: 'currency_mismatch' };
      }
    } else {
      this.logger.log(
        `[verifyPaymobRedirect] order=${shortOrder} currency absent; skip check (HMAC+amount+merchant ref; inquiry/webhook may apply)`,
      );
    }

    const integrationRaw = params.integration_id;
    if (integrationRaw != null && String(integrationRaw).trim() !== '') {
      const receivedIntegrationId = Number(integrationRaw);
      const expectedIntegrationId = this.getIntegrationId();
      if (
        !Number.isFinite(receivedIntegrationId) ||
        receivedIntegrationId !== expectedIntegrationId
      ) {
        this.logger.warn(
          `[verifyPaymobRedirect] order=${shortOrder} integration_mismatch received=${String(integrationRaw)} expected=${expectedIntegrationId}`,
        );
        return { verified: false, reason: 'integration_mismatch' };
      }
    } else {
      this.logger.log(
        `[verifyPaymobRedirect] order=${shortOrder} integration_id absent; skip check (HMAC+amount+merchant ref; inquiry/webhook may apply)`,
      );
    }

    const internalOrderId = String(order.id ?? '');
    const merchantRef = params.merchant_order_id;
    if (merchantRef && internalOrderId) {
      const extracted = this.extractInternalOrderIdFromPaymobRef(merchantRef);
      if (extracted && extracted !== internalOrderId) {
        return { verified: false, reason: 'merchant_order_mismatch' };
      }
    }

    return { verified: true };
  }

  async finalizePaymobOrderAfterReturn(
    orderId: string,
    token: string,
    redirectCallback?: Record<string, string>,
  ) {
    const orderBefore = await this.orderFinalizationService.assertCustomerOwnsOrder(
      token,
      orderId,
    );
    const paymentStatusBefore = String(
      orderBefore.payment_status || '',
    ).toLowerCase();
    const shortOrder = shortIdForLog(orderId);

    this.logger.log(
      `[finalizePaymobReturn] order=${shortOrder} statusBefore=${paymentStatusBefore} redirectParams=${redirectCallback ? Object.keys(redirectCallback).length : 0}`,
    );

    const reconciled = await this.reconcilePaymobPendingOrder(orderId, {
      redirectCallback,
      linkCustomerToken: token,
      expireIfStale: false,
    });

    const paymentStatusAfter = reconciled.paymentStatusAfter;
    const paid = paymentStatusAfter === 'paid';

    if (reconciled.action === 'failed' || reconciled.action === 'expired') {
      const order =
        reconciled.order ??
        (await this.orderFinalizationService.assertCustomerOwnsOrder(
          token,
          orderId,
        ));
      return {
        finalized: false,
        failed: reconciled.action === 'failed',
        expired: reconciled.action === 'expired',
        paymobVerified: false,
        stockReleased: reconciled.stockReleased,
        telegramSent: false,
        telegramAttempted: false,
        paymentStatusBefore,
        paymentStatusAfter,
        order,
      };
    }

    if (!paid) {
      const order =
        reconciled.order ??
        (await this.orderFinalizationService.assertCustomerOwnsOrder(
          token,
          orderId,
        ));
      return {
        finalized: false,
        awaitingConfirmation: true,
        paymobVerified: false,
        telegramSent: false,
        telegramAttempted: false,
        paymentStatusBefore,
        paymentStatusAfter,
        order,
      };
    }

    return {
      finalized: true,
      alreadyPaid: !reconciled.newlyFinalized,
      newlyFinalized: reconciled.newlyFinalized,
      paymobVerified: true,
      telegramSent: reconciled.telegramSent ?? false,
      telegramAttempted: reconciled.newlyFinalized,
      verificationSource: reconciled.verificationSource,
      paymentStatusBefore,
      paymentStatusAfter,
      order:
        reconciled.order ??
        (await this.orderFinalizationService.assertCustomerOwnsOrder(
          token,
          orderId,
        )),
    };
  }

  private paymobCoerceBooleanFlag(value: unknown): boolean {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    if (typeof value === 'string') {
      const s = value.trim().toLowerCase();
      return s === 'true' || s === '1' || s === 'yes';
    }
    return false;
  }

  async handlePaymobWebhook(body: Record<string, unknown>, hmac?: string) {
    this.logger.log('Paymob webhook received');
    const secret = this.configService.get<string>('PAYMOB_HMAC_SECRET');
    if (!secret) {
      throw new BadRequestException('PAYMOB_HMAC_SECRET is not configured');
    }

    const type = String(body.type || '');
    if (type !== 'TRANSACTION') {
      return { ok: true, ignored: true };
    }

    const obj = body.obj as Record<string, unknown> | undefined;
    if (!obj || typeof obj !== 'object') {
      throw new BadRequestException('Invalid webhook payload');
    }

    if (!verifyPaymobTransactionHmac(obj, hmac, secret)) {
      throw new UnauthorizedException('Invalid Paymob HMAC');
    }

    const supabase = this.supabaseService.getClient();
    const paymobOrder = obj.order as Record<string, unknown> | undefined;
    const paymobOrderId =
      paymobOrder && paymobOrder.id != null ? String(paymobOrder.id) : null;

    if (!paymobOrderId) {
      throw new BadRequestException('Missing Paymob order id in callback');
    }

    let orderRow: {
      id: string;
      payment_status: string;
      total: number;
      payment_method: string;
    } | null = null;

    const { data: byPaymobOrder, error: findError } = await supabase
      .from('orders')
      .select('id, payment_status, total, payment_method')
      .eq('paymob_order_id', paymobOrderId)
      .maybeSingle();

    if (findError) {
      throw new BadRequestException(findError.message);
    }
    orderRow = byPaymobOrder;

    const merchantOrderId =
      paymobOrder && paymobOrder.merchant_order_id != null
        ? String(paymobOrder.merchant_order_id)
        : null;

    if (!orderRow && merchantOrderId) {
      const { data: byMerchant } = await supabase
        .from('orders')
        .select('id, payment_status, total, payment_method')
        .eq('id', merchantOrderId)
        .maybeSingle();
      orderRow = byMerchant;
    }

    if (!orderRow && merchantOrderId) {
      const internalOrderId =
        this.extractInternalOrderIdFromPaymobRef(merchantOrderId);
      if (internalOrderId) {
        const { data: byInternal } = await supabase
          .from('orders')
          .select('id, payment_status, total, payment_method')
          .eq('id', internalOrderId)
          .maybeSingle();
        orderRow = byInternal;
      }
    }

    if (!orderRow) {
      throw new BadRequestException('Order not found for Paymob callback');
    }
    this.logger.log('Paymob webhook: order matched');

    const success = this.paymobCoerceBooleanFlag(obj.success);
    const pending = this.paymobCoerceBooleanFlag(obj.pending);
    const transactionId = obj.id != null ? String(obj.id) : null;
    const expectedAmountCents = Math.round(Number(orderRow.total) * 100);
    const receivedAmountCents = Number(obj.amount_cents);
    const receivedCurrency = String(obj.currency || '').toUpperCase();
    const expectedCurrency = String(this.getCurrency() || 'EGP').toUpperCase();
    const receivedIntegrationId = Number(obj.integration_id);
    const expectedIntegrationId = this.getIntegrationId();

    if (pending) {
      return { ok: true, awaiting: true };
    }

    if (success) {
      if (orderRow.payment_status === 'paid') {
        return { ok: true, duplicate: true };
      }

      if (receivedAmountCents !== expectedAmountCents) {
        const { error: mismatchErr } = await supabase
          .from('orders')
          .update({
            payment_failure_reason: 'Paymob amount mismatch',
            payment_raw_response: body as object,
            paymob_transaction_id: transactionId,
          })
          .eq('id', orderRow.id);
        if (mismatchErr) throw new BadRequestException(mismatchErr.message);
        this.logger.warn('Paymob webhook: amount mismatch');
        throw new BadRequestException('Paymob amount mismatch');
      }

      if (receivedCurrency !== expectedCurrency) {
        const { error: currencyErr } = await supabase
          .from('orders')
          .update({
            payment_failure_reason: 'Paymob currency mismatch',
            payment_raw_response: body as object,
            paymob_transaction_id: transactionId,
          })
          .eq('id', orderRow.id);
        if (currencyErr) throw new BadRequestException(currencyErr.message);
        this.logger.warn('Paymob webhook: currency mismatch');
        throw new BadRequestException('Paymob currency mismatch');
      }

      if (receivedIntegrationId !== expectedIntegrationId) {
        const { error: integrationErr } = await supabase
          .from('orders')
          .update({
            payment_failure_reason: 'Paymob integration mismatch',
            payment_raw_response: body as object,
            paymob_transaction_id: transactionId,
          })
          .eq('id', orderRow.id);
        if (integrationErr) throw new BadRequestException(integrationErr.message);
        this.logger.warn('Paymob webhook: integration mismatch');
        throw new BadRequestException('Paymob integration mismatch');
      }

      this.logger.log('Paymob webhook: payment verified');

      const finalizeResult = await this.orderFinalizationService.finalizePaidOrder(
        orderRow.id,
        'paymob_webhook',
        {
          paymobTransactionId: transactionId,
          paymobRaw: body as object,
        },
      );

      return {
        ok: true,
        paid: true,
        newlyFinalized: finalizeResult.newlyFinalized,
        duplicate: finalizeResult.alreadyPaid && !finalizeResult.newlyFinalized,
      };
    }

    const failureParts: string[] = [];
    if (obj.data && typeof obj.data === 'object') {
      const d = obj.data as Record<string, unknown>;
      if (d.message) failureParts.push(String(d.message));
      if (d.txn_response_code) failureParts.push(String(d.txn_response_code));
    }
    if (!success) failureParts.push('success=false');

    const failureReason = failureParts.join(' · ') || 'Payment failed';

    if (transactionId) {
      await supabase
        .from('orders')
        .update({
          paymob_transaction_id: transactionId,
          payment_raw_response: body as object,
        })
        .eq('id', orderRow.id);
    }

    const releaseResult =
      await this.paymobOrderCleanupService.releaseUnpaidPaymobOrderInventory(
        orderRow.id,
        'failed',
        { paymentFailureReason: failureReason },
      );

    this.logger.log(
      `Paymob webhook: payment failed stockReleased=${releaseResult.stockRestored} released=${releaseResult.released}`,
    );
    return {
      ok: true,
      failed: true,
      stockReleased: releaseResult.stockRestored,
    };
  }
}
