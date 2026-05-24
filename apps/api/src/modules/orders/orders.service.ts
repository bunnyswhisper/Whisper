import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderEmailService } from '../email/order-email.service';
import type { OrderEmailOrderRow } from '../email/order-email.types';
import { EventQrService } from '../event-qr/event-qr.service';
import type { AdminOrderNotificationInput } from '../notifications/admin-order-notification.types';
import { assertCustomerOrderOwnership } from '../../common/customer-order-ownership';
import { maskEmailForLog, shortIdForLog } from '../../common/safe-log';
import { PaymobOrderCleanupService } from './paymob-order-cleanup.service';
import { PaymentsService } from '../payments/payments.service';

type OrderItemInput = {
  productId: string;
  variantId: string;
  name: string;
  size: string;
  color: string;
  quantity: number;
  /** Display-only; RPC prices from DB. */
  price?: number;
};

type CreateOrderInput = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  city: string;
  area: string;
  street: string;
  notes?: string;
  items: OrderItemInput[];
  couponCode?: string | null;
  paymentMethod?: 'cash_on_delivery' | 'paymob';
  discountSource?: 'none' | 'coupon' | 'event';
  eventCampaignId?: string | null;
  /** Resolves to eventCampaignId when only code is sent */
  eventCampaignCode?: string | null;
  eventDeviceKey?: string | null;
  /** Hint only; reconcile uses DB campaign percent. */
  eventDiscountPercent?: number | null;
};

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/** Printable uppercase alnum without O/0/I/1 (QR / manual entry). */
const CLAIM_CODE_SYMBOLS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const MAX_CLAIM_CODE_ATTEMPTS = 12;

function generateSecureOrderClaimCode(): string {
  const segment = (length: number): string => {
    const bytes = randomBytes(length * 2);
    let s = '';
    for (let i = 0; i < length; i++) {
      s += CLAIM_CODE_SYMBOLS[bytes[i]! % CLAIM_CODE_SYMBOLS.length];
    }
    return s;
  };
  return `BW-ORDER-${segment(4)}-${segment(4)}-${segment(4)}`;
}

function isClaimCodeUniqueViolation(err: {
  code?: string;
  message?: string;
}): boolean {
  const code = String(err.code ?? '');
  const msg = String(err.message ?? '').toLowerCase();
  return (
    code === '23505' ||
    msg.includes('duplicate') ||
    msg.includes('unique')
  );
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly orderEmailService: OrderEmailService,
    private readonly eventQrService: EventQrService,
    private readonly paymobOrderCleanupService: PaymobOrderCleanupService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Paymob checkout attempts that never completed — hidden from My Orders only.
   * Pending card orders stay visible (receipt / Track Order) while payment confirms.
   */
  private isIncompletePaymobOrder(order: {
    payment_method?: string | null;
    payment_status?: string | null;
  }): boolean {
    const method = String(order.payment_method || '').toLowerCase();
    const status = String(order.payment_status || '').toLowerCase();
    if (method !== 'paymob') return false;
    return status === 'expired' || status === 'failed';
  }

  private isStalePaymobPending(order: {
    payment_method?: string | null;
    payment_status?: string | null;
    created_at?: string | null;
  }): boolean {
    const method = String(order.payment_method || '').toLowerCase();
    const status = String(order.payment_status || '').toLowerCase();
    if (method !== 'paymob' || status !== 'pending') return false;
    if (!order.created_at) return false;
    const createdAtMs = new Date(order.created_at).getTime();
    if (!Number.isFinite(createdAtMs)) return false;
    const ttlMs =
      this.paymobOrderCleanupService.getPendingExpiryMinutes() * 60 * 1000;
    return createdAtMs < Date.now() - ttlMs;
  }

  private async expirePaymobPendingOrderIfNeeded(order: any): Promise<any> {
    if (!this.isStalePaymobPending(order)) return order;

    const result =
      await this.paymobOrderCleanupService.releaseUnpaidPaymobOrderInventory(
        String(order.id),
        'expired',
        { paymentFailureReason: 'Payment session expired' },
      );

    if (result.released) {
      return {
        ...order,
        payment_status: result.paymentStatusAfter || 'expired',
        status: 'cancelled',
        payment_failure_reason: 'Payment session expired',
      };
    }

    return order;
  }

  private extractOrderId(data: any) {
    return (
      data?.orderId ||
      data?.order_id ||
      data?.id ||
      data?.[0]?.orderId ||
      data?.[0]?.order_id ||
      data?.[0]?.id
    );
  }

  /**
   * Align stored discount_amount and total with coupon % on (subtotal + delivery_fee).
   * No VAT in the coupon base (vat_amount stays 0 until explicitly enabled).
   * Supabase RPC may still use subtotal-only; this runs after create so Paymob/COD match checkout.
   */
  private async reconcileCouponOrderTotals(
    orderId: string,
    userId: string,
    couponCode: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const cleanCode = couponCode.trim().toUpperCase();

    const { data: orderRow, error: orderErr } = await supabase
      .from('orders')
      .select('subtotal, delivery_fee')
      .eq('id', orderId)
      .maybeSingle();

    if (orderErr || !orderRow) {
      this.logger.warn(
        `Coupon reconcile: could not load order ${orderId}: ${orderErr?.message || 'missing'}`,
      );
      return;
    }

    const { data: couponRows, error: couponErr } = await supabase
      .from('customer_coupons')
      .select('discount_percent, code')
      .eq('user_id', userId)
      .ilike('code', cleanCode)
      .eq('is_used', false)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    const coupon = couponRows?.[0];

    if (couponErr || !coupon) {
      this.logger.warn(
        `Coupon reconcile: no coupon row for user/order ${orderId} code ${cleanCode}`,
      );
      return;
    }

    const subtotal = Number(orderRow.subtotal || 0);
    const delivery = Number(orderRow.delivery_fee ?? subtotal * 0.12);
    const discountBase = Number((subtotal + delivery).toFixed(2));
    const pct = Number(coupon.discount_percent || 0);
    const discountAmount = Number(((discountBase * pct) / 100).toFixed(2));
    const total = Math.max(
      0,
      Number((discountBase - discountAmount).toFixed(2)),
    );

    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        discount_amount: discountAmount,
        total,
        coupon_code: coupon.code,
        discount_source: 'coupon',
        event_campaign_id: null,
        event_discount_percent: null,
      })
      .eq('id', orderId);

    if (updateErr) {
      this.logger.warn(
        `Coupon reconcile: update failed for order ${orderId}: ${updateErr.message}`,
      );
    }
  }

  /** If booth reconcile fails, reset order totals to undiscounted (subtotal + delivery). */
  private async stripEventDiscountFromOrder(orderId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: row, error } = await supabase
      .from('orders')
      .select('subtotal, delivery_fee')
      .eq('id', orderId)
      .maybeSingle();
    if (error || !row) return;
    const subtotal = Number(row.subtotal || 0);
    const delivery = Number(row.delivery_fee ?? subtotal * 0.12);
    const total = Math.max(0, Number((subtotal + delivery).toFixed(2)));
    await supabase
      .from('orders')
      .update({
        discount_amount: 0,
        total,
        discount_source: 'none',
        coupon_code: null,
        event_campaign_id: null,
        event_discount_percent: null,
      })
      .eq('id', orderId);
  }

  private assertNoConflictingDiscountFields(body: CreateOrderInput): void {
    const hasCoupon = Boolean(body.couponCode?.trim());
    const hasEventHint = Boolean(
      body.eventCampaignId?.trim() ||
        body.eventCampaignCode?.trim() ||
        body.eventDeviceKey?.trim(),
    );
    if (hasCoupon && hasEventHint) {
      throw new BadRequestException(
        'Coupon and booth discount cannot be combined.',
      );
    }
  }

  /** Totals returned inline by create_order_with_inventory (shape varies). */
  private pickTotalFromRpcPayload(data: unknown): number {
    if (!data || typeof data !== 'object') return 0;
    const o = data as Record<string, unknown>;
    if (typeof o.total === 'number' && Number.isFinite(o.total)) {
      return o.total;
    }
    const nested = o.order;
    if (nested && typeof nested === 'object') {
      const t = (nested as Record<string, unknown>).total;
      if (typeof t === 'number' && Number.isFinite(t)) return t;
    }
    return 0;
  }

  private buildCodTelegramFallback(
    orderId: string,
    body: CreateOrderInput,
    rpcData: unknown,
  ): AdminOrderNotificationInput {
    const total = this.pickTotalFromRpcPayload(rpcData);
    return {
      id: orderId,
      customer_name: body.customerName,
      customer_email: body.customerEmail ?? null,
      total,
      payment_method: 'cash_on_delivery',
      payment_status: 'unpaid',
      status: 'pending',
      city: body.city,
      area: body.area,
      street: body.street,
      order_items: body.items.map((it) => ({ quantity: it.quantity })),
    };
  }

  async getAnalyticsExtra() {
    const supabase = this.supabaseService.getClient();
  
    const [abandonedCartsRes, couponsRes, pointsRes] = await Promise.all([
      supabase.from('abandoned_carts').select('*'),
      supabase.from('customer_coupons').select('*'),
      supabase.from('customer_points').select('*'),
    ]);
  
    if (abandonedCartsRes.error) {
      throw new BadRequestException(abandonedCartsRes.error.message);
    }
  
    if (couponsRes.error) {
      throw new BadRequestException(couponsRes.error.message);
    }
  
    if (pointsRes.error) {
      throw new BadRequestException(pointsRes.error.message);
    }

    const eventQrCampaigns = await this.eventQrService.listCampaignsWithStats();

    return {
      abandonedCarts: abandonedCartsRes.data || [],
      coupons: couponsRes.data || [],
      points: pointsRes.data || [],
      eventQrCampaigns,
    };
  }

  async createOrder(body: CreateOrderInput, token?: string) {
    const supabase = this.supabaseService.getClient();
  
    if (!body.items || body.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    this.assertNoConflictingDiscountFields(body);

    let userId: string | null = null;
    let authEmail: string | null = null;

    if (token) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);

      if (userError || !user) {
        throw new UnauthorizedException('Invalid customer token');
      }

      userId = user.id;
      authEmail = user.email?.trim().toLowerCase() ?? null;
    }

    let resolvedEventCampaignId = body.eventCampaignId?.trim() ?? '';
    if (!resolvedEventCampaignId && body.eventCampaignCode?.trim()) {
      const campRow = await this.eventQrService.getCampaignByCode(
        body.eventCampaignCode.trim(),
      );
      if (campRow?.id) {
        resolvedEventCampaignId = campRow.id;
      }
    }

    const inferredEvent =
      Boolean(resolvedEventCampaignId) ||
      Boolean(body.eventCampaignId?.trim()) ||
      Boolean(body.eventCampaignCode?.trim());

    const discountSource: 'none' | 'coupon' | 'event' =
      body.discountSource ??
      (inferredEvent
        ? 'event'
        : body.couponCode?.trim()
          ? 'coupon'
          : 'none');

    this.logger.log(
      `[createOrder] discountSource=${discountSource} campaign_hint=${resolvedEventCampaignId ? 'yes' : 'no'} device_key=${body.eventDeviceKey?.trim() ? 'yes' : 'no'} user=${shortIdForLog(userId)} email=${maskEmailForLog(authEmail)} coupon=${body.couponCode?.trim() ? 'set' : 'empty'}`,
    );

    if (body.couponCode?.trim() && discountSource === 'event') {
      throw new BadRequestException(
        'Booth discounts and coupons cannot be combined.',
      );
    }

    if (body.couponCode && !userId) {
      throw new UnauthorizedException('Login required to use coupon');
    }

    if (discountSource === 'event') {
      if (!userId) {
        throw new UnauthorizedException(
          'Login required to use booth discount',
        );
      }
      if (!resolvedEventCampaignId) {
        if (body.eventCampaignCode?.trim()) {
          throw new BadRequestException('Invalid booth campaign code.');
        }
        throw new BadRequestException(
          'eventCampaignId or eventCampaignCode is required for booth discount',
        );
      }
    }

    let eventValidated: {
      discountPercent: number;
      redemptionId: string;
      campaignId: string;
    } | null = null;

    if (discountSource === 'event' && resolvedEventCampaignId && userId) {
      this.logger.log(
        `[createOrder] booth validation start campaign=${shortIdForLog(resolvedEventCampaignId)} device_key=${Boolean(body.eventDeviceKey?.trim())}`,
      );
      try {
        const ev = await this.eventQrService.validateEventDiscountForOrder({
          campaignId: resolvedEventCampaignId,
          userId,
          email:
            authEmail ||
            body.customerEmail?.trim().toLowerCase() ||
            null,
          deviceKey: body.eventDeviceKey?.trim() || null,
          campaignCode: body.eventCampaignCode?.trim() || null,
        });
        eventValidated = {
          discountPercent: ev.discountPercent,
          redemptionId: ev.redemptionId,
          campaignId: resolvedEventCampaignId,
        };
        this.logger.log(
          `[createOrder] booth validation OK redemption=${shortIdForLog(eventValidated.redemptionId)}`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[createOrder] booth validation FAILED: ${msg}`);
        throw e;
      }
    }

    const rpcCouponCode =
      discountSource === 'event' ? null : body.couponCode || null;

    const customerEmailForOrder =
      authEmail ??
      body.customerEmail?.trim().toLowerCase() ??
      null;

    const { data, error } = await supabase.rpc('create_order_with_inventory', {
      p_customer_name: body.customerName,
      p_customer_phone: body.customerPhone,
      p_customer_email: customerEmailForOrder,
      p_city: body.city,
      p_area: body.area,
      p_street: body.street,
      p_notes: body.notes || null,
      p_items: body.items,
      p_user_id: userId,
      p_coupon_code: rpcCouponCode,
    });
  
    if (error) {
      throw new BadRequestException(error.message);
    }
  
    const orderId = this.extractOrderId(data);
  
    if (!orderId) {
      throw new BadRequestException(
        'Order was created but order ID was not returned from RPC',
      );
    }

    if (userId) {
      const { error: linkErr } = await supabase
        .from('orders')
        .update({
          user_id: userId,
          ...(customerEmailForOrder
            ? { customer_email: customerEmailForOrder }
            : {}),
        })
        .eq('id', orderId);

      if (linkErr) {
        this.logger.warn(
          `[createOrder] link user/email failed order=${shortIdForLog(orderId)}: ${linkErr.message}`,
        );
      }
    }

    this.logger.log(
      `[createOrder] created order=${shortIdForLog(orderId)} user=${shortIdForLog(userId)} customerEmail=${maskEmailForLog(customerEmailForOrder)} payment=${body.paymentMethod ?? 'cod'}`,
    );
  
    let claimCode: string | undefined;
    let claimAssignError: { code?: string; message?: string } | null = null;

    for (let attempt = 0; attempt < MAX_CLAIM_CODE_ATTEMPTS; attempt++) {
      const candidate = generateSecureOrderClaimCode();
      const { error: claimError } = await supabase
        .from('orders')
        .update({ claim_code: candidate })
        .eq('id', orderId);

      if (!claimError) {
        claimCode = candidate;
        claimAssignError = null;
        break;
      }

      claimAssignError = claimError;
      if (!isClaimCodeUniqueViolation(claimError)) {
        throw new BadRequestException(claimError.message);
      }

      if (attempt === MAX_CLAIM_CODE_ATTEMPTS - 1) {
        break;
      }

      this.logger.warn(
        `claim_code collision for order ${orderId.slice(0, 8)}… (attempt ${attempt + 1}/${MAX_CLAIM_CODE_ATTEMPTS})`,
      );
    }

    if (!claimCode) {
      throw new BadRequestException(
        claimAssignError?.message ||
          'Could not assign a unique claim code. Please try again.',
      );
    }

    if (body.paymentMethod === 'paymob') {
      const { error: paymobMetaError } = await supabase
        .from('orders')
        .update({
          payment_method: 'paymob',
          payment_status: 'pending',
          status: 'pending',
        })
        .eq('id', orderId);

      if (paymobMetaError) {
        throw new BadRequestException(paymobMetaError.message);
      }
    }

    if (eventValidated) {
      try {
        await this.eventQrService.reconcileEventOrderTotals({
          orderId,
          campaignId: eventValidated.campaignId,
          discountPercent: eventValidated.discountPercent,
          redemptionId: eventValidated.redemptionId,
        });
        const { data: totRow } = await supabase
          .from('orders')
          .select('subtotal, delivery_fee, discount_amount, total')
          .eq('id', orderId)
          .maybeSingle();
        this.logger.log(
          `[createOrder] booth totals reconciled order=${shortIdForLog(orderId)} totals=${totRow ? 'ok' : 'missing'}`,
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.warn(`[createOrder] booth reconcile failed: ${msg}`);
        await this.stripEventDiscountFromOrder(orderId);
        if (e instanceof ConflictException) {
          throw new BadRequestException(
            'This booth discount is no longer available. Your order was placed at full price.',
          );
        }
        if (e instanceof BadRequestException || e instanceof UnauthorizedException) {
          throw e;
        }
        throw new BadRequestException('Could not apply booth discount.');
      }
    } else if (
      userId &&
      body.couponCode?.trim() &&
      discountSource !== 'event'
    ) {
      await this.reconcileCouponOrderTotals(orderId, userId, body.couponCode);
    } else if (
      discountSource !== 'event' &&
      !body.couponCode?.trim()
    ) {
      await supabase
        .from('orders')
        .update({
          discount_source: 'none',
          event_campaign_id: null,
          event_discount_percent: null,
        })
        .eq('id', orderId);
    }

    let finalOrder: Record<string, unknown> | null = null;
    const withItems = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (withItems.error) {
      this.logger.warn(
        `Order reload with order_items failed (${orderId.slice(0, 8)}…): ${withItems.error.message}`,
      );
      const simple = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .maybeSingle();
      if (simple.error) {
        this.logger.warn(
          `Order reload without embed failed (${orderId.slice(0, 8)}…): ${simple.error.message}`,
        );
      } else {
        finalOrder = simple.data as Record<string, unknown>;
      }
    } else {
      finalOrder = withItems.data as Record<string, unknown> | null;
    }

    const orderPayload =
      data && typeof data === 'object' && !Array.isArray(data)
        ? { ...(data as Record<string, unknown>) }
        : {};

    const isCodPath = body.paymentMethod !== 'paymob';

    /** Real COD / non-card orders only — not Paymob pending creates. */
    if (isCodPath) {
      let notifyPayload: AdminOrderNotificationInput | null = null;
      if (finalOrder) {
        notifyPayload = finalOrder as unknown as AdminOrderNotificationInput;
      } else {
        this.logger.warn(
          `Order row missing after create; notification fallback from request (${orderId.slice(0, 8)}…)`,
        );
        notifyPayload = this.buildCodTelegramFallback(orderId, body, data);
      }
      if (notifyPayload) {
        const merged: AdminOrderNotificationInput = {
          ...notifyPayload,
          payment_method:
            String(notifyPayload.payment_method || '').trim() ||
            'cash_on_delivery',
        };
        const shortNotify = orderId.replace(/-/g, '').slice(0, 8);
        const telegramPayload: AdminOrderNotificationInput = {
          ...merged,
          customer_name: merged.customer_name || body.customerName,
          customer_email:
            merged.customer_email ?? body.customerEmail ?? null,
          city: merged.city || body.city,
          area: merged.area || body.area,
          street: merged.street || body.street,
          total:
            merged.total != null
              ? merged.total
              : this.pickTotalFromRpcPayload(data),
          order_items:
            merged.order_items ??
            body.items.map((it) => ({ quantity: it.quantity })),
        };
        void this.notificationsService
          .sendAdminTelegramNewOrder(telegramPayload)
          .then((result) => {
            if (result.sent) {
              this.logger.log(
                `COD Telegram notification sent for order ${shortNotify}`,
              );
            } else {
              this.logger.warn(
                `COD Telegram not sent for order ${shortNotify}: ${result.skipped || result.error || 'unknown'}`,
              );
            }
          })
          .catch((err) => {
            this.logger.warn(
              `COD Telegram error for order ${shortNotify}: ${err instanceof Error ? err.message : 'unknown'}`,
            );
          });
        this.orderEmailService.sendCodConfirmation(merged);
      }
    }

    return {
      ...orderPayload,
      orderId,
      claimCode,
      order: finalOrder ?? null,
      total: finalOrder?.total ?? (orderPayload as { total?: number }).total,
    };
  }

  async findMyOrderById(token: string, orderId: string) {
    const supabase = this.supabaseService.getClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new UnauthorizedException('Invalid customer token');
    }

    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items (*)
      `,
      )
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    assertCustomerOrderOwnership(
      this.logger,
      'findMyOrderById',
      data,
      user,
      orderId,
    );

    this.logger.log(
      `[findMyOrderById] ok order=${shortIdForLog(orderId)} payment=${String(data.payment_method)} status=${String(data.payment_status)}`,
    );

    const method = String(data.payment_method || '').toLowerCase();
    const paymentStatus = String(data.payment_status || '').toLowerCase();
    if (method === 'paymob' && paymentStatus === 'pending') {
      try {
        const reconciled = await this.paymentsService.reconcilePaymobPendingOrder(
          orderId,
          { expireIfStale: true },
        );
        if (reconciled.order) {
          return reconciled.order;
        }
      } catch (err) {
        this.logger.warn(
          `[findMyOrderById] Paymob reconcile failed order=${shortIdForLog(orderId)}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    }

    return this.expirePaymobPendingOrderIfNeeded(data);
  }

  async findMyOrders(token: string) {
    const supabase = this.supabaseService.getClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new UnauthorizedException('Invalid customer token');
    }

    const email = user.email?.trim().toLowerCase() ?? '';

    const baseQuery = supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .order('created_at', { ascending: false });

    const { data, error } = email
      ? await baseQuery.or(
          `user_id.eq.${user.id},customer_email.ilike.${email}`,
        )
      : await baseQuery.eq('user_id', user.id);

    if (error) {
      throw new BadRequestException(error.message);
    }

    const withExpiry = await Promise.all(
      (data || []).map((order) => this.expirePaymobPendingOrderIfNeeded(order)),
    );
    const visible = withExpiry.filter(
      (order) => !this.isIncompletePaymobOrder(order),
    );

    const paymobPendingVisible = visible.filter(
      (o) =>
        String(o.payment_method || '').toLowerCase() === 'paymob' &&
        String(o.payment_status || '').toLowerCase() === 'pending',
    ).length;
    const hiddenIncomplete = (data || []).length - visible.length;

    this.logger.log(
      `[findMyOrders] user=${shortIdForLog(user.id)} email=${maskEmailForLog(email)} raw=${(data || []).length} returned=${visible.length} hiddenIncomplete=${hiddenIncomplete} paymobPendingVisible=${paymobPendingVisible}`,
    );

    return visible;
  }

  async findAllOrders() {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data;
  }
  async returnClaimedOrder(orderId: string, reason: string) {
    const supabase = this.supabaseService.getClient();
  
    const { error } = await supabase.rpc('admin_return_claimed_order_safe', {
      p_order_id: orderId,
      p_reason: reason,
    });
  
    if (error) {
      throw new BadRequestException(error.message);
    }
  
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single();
  
    if (fetchError) {
      throw new BadRequestException(fetchError.message);
    }

    const orderForEmail = data as OrderEmailOrderRow;
    if (this.orderStatusKey(orderForEmail.status) === 'cancelled') {
      this.orderEmailService.sendOrderCancelled(orderForEmail);
    }

    return data;
  }

  private orderStatusKey(status: unknown): string {
    return String(status || '')
      .toLowerCase()
      .trim();
  }

  /**
   * Open workflow updates (placed/shipped …) skip `update_order_status_safe` so legacy RPC rules
   * cannot block admin after uncancel due to points_claimed / points_reversed history.
   * RPC stays for: cancel (stock), and any change while current status is final (delivered/cancelled/returned).
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    cancellationReason?: string,
  ) {
    const supabase = this.supabaseService.getClient();
    const reasonTrim = cancellationReason?.trim() || '';

    const { data: orderRow, error: fetchErr } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchErr) {
      throw new BadRequestException(fetchErr.message);
    }
    if (!orderRow) {
      throw new BadRequestException('Order not found');
    }

    const current = this.orderStatusKey(orderRow.status);
    const previousStatus = current;
    const useRpc =
      status === 'cancelled' ||
      current === 'delivered' ||
      current === 'cancelled' ||
      current === 'returned';

    if (useRpc) {
      const { error } = await supabase.rpc('update_order_status_safe', {
        p_order_id: orderId,
        p_status: status,
      });

      if (error) {
        throw new BadRequestException(error.message);
      }
    } else {
      const { error: directErr } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (directErr) {
        throw new BadRequestException(directErr.message);
      }
    }

    if (status === 'delivered') {
      const { error: paymentError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
        })
        .eq('id', orderId);
  
      if (paymentError) {
        throw new BadRequestException(paymentError.message);
      }
    }
  
    const { data, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('id', orderId)
      .single();
  
    if (fetchError) {
      throw new BadRequestException(fetchError.message);
    }

    const orderForEmail = data as OrderEmailOrderRow;
    if (previousStatus !== 'shipped' && status === 'shipped') {
      this.orderEmailService.sendOrderShipped(orderForEmail);
    }
    if (previousStatus !== 'delivered' && status === 'delivered') {
      this.orderEmailService.sendOrderDelivered(orderForEmail);
    }
    if (previousStatus !== 'cancelled' && status === 'cancelled') {
      if (reasonTrim) {
        const { error: reasonErr } = await supabase
          .from('orders')
          .update({ admin_cancellation_reason: reasonTrim })
          .eq('id', orderId);
        if (reasonErr) {
          this.logger.warn(
            `[updateOrderStatus] admin_cancellation_reason save failed order=${orderId.slice(0, 8)}: ${reasonErr.message}`,
          );
        } else {
          orderForEmail.admin_cancellation_reason = reasonTrim;
        }
      }
      this.orderEmailService.sendOrderCancelled(orderForEmail);
    }

    return data;
  }

  private async resolveVariantIdForOrderItem(
    supabase: ReturnType<SupabaseService['getClient']>,
    item: Record<string, unknown>,
  ): Promise<string> {
    const direct =
      (item.variant_id as string) ||
      (item.product_variant_id as string) ||
      (item.productVariantId as string);
    if (direct && String(direct).length > 0) return String(direct);

    const productId = item.product_id as string | undefined;
    const size = String(item.size || '').trim();
    const color = String(item.color || '').trim();
    const productName = String(item.product_name || '').trim();

    if (productId) {
      const { data: v, error } = await supabase
        .from('product_variants')
        .select('id')
        .eq('product_id', productId)
        .eq('size', size)
        .eq('color', color)
        .maybeSingle();
      if (error) throw new BadRequestException(error.message);
      if (v?.id) return String(v.id);
    }

    if (productName) {
      const { data: prod, error: pErr } = await supabase
        .from('products')
        .select('id')
        .ilike('name', productName)
        .maybeSingle();
      if (pErr) throw new BadRequestException(pErr.message);
      if (prod?.id) {
        const { data: v, error } = await supabase
          .from('product_variants')
          .select('id')
          .eq('product_id', prod.id)
          .eq('size', size)
          .eq('color', color)
          .maybeSingle();
        if (error) throw new BadRequestException(error.message);
        if (v?.id) return String(v.id);
      }
    }

    throw new BadRequestException(
      `Cannot resolve inventory variant for line item "${productName || 'unknown'}" (${color} / ${size}).`,
    );
  }

  /**
   * Restore a mistakenly cancelled order: re-deduct stock (with availability check),
   * reset lifecycle to pending (placed), clear return/cancel lock fields. Does not touch Paymob,
   * coupons, payment_status, or points_* flags — admin can ship/deliver again; claim follows normal rules.
   */
  async uncancelOrder(
    orderId: string,
    reason?: string | null,
    adminToken?: string,
  ) {
    const supabase = this.supabaseService.getClient();

    let uncancelledBy: string | null = null;
    if (adminToken) {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser(adminToken);
      if (!userErr && user?.id) {
        uncancelledBy = user.id;
      }
    }

    const trimmedReason = String(reason || '').trim();
    const uncancelReason =
      trimmedReason.length > 0
        ? trimmedReason
        : 'Admin restored cancelled order';

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items (*)
      `,
      )
      .eq('id', orderId)
      .maybeSingle();

    if (orderError) {
      throw new BadRequestException(orderError.message);
    }

    if (!order) {
      throw new BadRequestException('Order not found');
    }

    if (String(order.status || '').toLowerCase() !== 'cancelled') {
      throw new BadRequestException('Only cancelled orders can be uncancelled.');
    }

    const items = Array.isArray(order.order_items) ? order.order_items : [];

    if (items.length === 0) {
      throw new BadRequestException('Order has no line items.');
    }

    const variantOps: { variantId: string; qty: number; label: string }[] = [];

    for (const raw of items) {
      const item = raw as Record<string, unknown>;
      const qty = Math.max(0, Math.floor(Number(item.quantity || 0)));
      if (qty <= 0) continue;
      const variantId = await this.resolveVariantIdForOrderItem(supabase, item);
      const label = `${String(item.product_name || 'Item')} (${String(item.color || '')} / ${String(item.size || '')})`;
      variantOps.push({ variantId, qty, label });
    }

    const rolledBack: { variantId: string; restoreStock: number }[] = [];

    try {
      for (const op of variantOps) {
        const { data: row, error: readErr } = await supabase
          .from('product_variants')
          .select('id, stock_quantity, reserved_quantity')
          .eq('id', op.variantId)
          .maybeSingle();

        if (readErr) throw new BadRequestException(readErr.message);
        if (!row) {
          throw new BadRequestException(
            `Cannot uncancel: variant not found for ${op.label}.`,
          );
        }

        const current = Number(row.stock_quantity || 0);
        const reserved = Number(row.reserved_quantity || 0);
        const available = current - reserved;

        if (available < op.qty) {
          throw new BadRequestException(
            `Cannot uncancel: not enough stock for ${op.label}.`,
          );
        }

        const nextStock = current - op.qty;
        const { data: updated, error: updErr } = await supabase
          .from('product_variants')
          .update({ stock_quantity: nextStock })
          .eq('id', op.variantId)
          .eq('stock_quantity', current)
          .select('id')
          .maybeSingle();

        if (updErr) throw new BadRequestException(updErr.message);
        if (!updated) {
          throw new BadRequestException(
            `Stock changed while uncancelling (${op.label}). Try again.`,
          );
        }
        rolledBack.push({ variantId: op.variantId, restoreStock: current });
      }

      const nextStatus: OrderStatus = 'pending';

      const { data: updatedOrderRows, error: updOrderErr } = await supabase
        .from('orders')
        .update({
          status: nextStatus,
          return_reason: null,
          returned_at: null,
          uncancelled_at: new Date().toISOString(),
          uncancel_reason: uncancelReason,
          uncancelled_by: uncancelledBy,
        })
        .eq('id', orderId)
        .eq('status', 'cancelled')
        .select('id');

      if (updOrderErr) {
        throw new BadRequestException(updOrderErr.message);
      }

      if (!updatedOrderRows || updatedOrderRows.length === 0) {
        throw new BadRequestException(
          'Order could not be uncancelled — it may no longer be cancelled.',
        );
      }

      this.logger.log(
        `Order ${orderId} uncancelled → pending (stock re-deducted for ${variantOps.length} variant line(s))`,
      );
    } catch (err) {
      for (const rb of rolledBack.reverse()) {
        const { error: revErr } = await supabase
          .from('product_variants')
          .update({ stock_quantity: rb.restoreStock })
          .eq('id', rb.variantId);
        if (revErr) {
          this.logger.error(
            `uncancelOrder rollback failed for variant ${rb.variantId}: ${revErr.message}`,
          );
        }
      }
      if (err instanceof BadRequestException) throw err;
      throw err;
    }

    const { data: fresh, error: fetchError } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items (*)
      `,
      )
      .eq('id', orderId)
      .single();

    if (fetchError) {
      throw new BadRequestException(fetchError.message);
    }

    return fresh;
  }
}