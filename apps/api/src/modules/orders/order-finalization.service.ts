import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderEmailService } from '../email/order-email.service';
import type { AdminOrderNotificationInput } from '../notifications/admin-order-notification.types';
import { assertCustomerOrderOwnership } from '../../common/customer-order-ownership';
import { shortIdForLog } from '../../common/safe-log';

export type FinalizePaidOrderSource =
  | 'paymob_webhook'
  | 'paymob_return'
  | 'paymob_reconcile';

export type FinalizePaidOrderResult = {
  orderId: string;
  newlyFinalized: boolean;
  alreadyPaid: boolean;
  telegramAttempted: boolean;
  telegramSent: boolean;
  order: Record<string, unknown> | null;
};

@Injectable()
export class OrderFinalizationService {
  private readonly logger = new Logger(OrderFinalizationService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
    private readonly orderEmailService: OrderEmailService,
  ) {}

  private async loadOrderWithItems(
    orderId: string,
  ): Promise<Record<string, unknown> | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    return data as Record<string, unknown> | null;
  }

  /**
   * Idempotent paid-order finalization (Telegram + confirmed status).
   * Matches successful COD side effects for admin notification.
   */
  async finalizePaidOrder(
    orderId: string,
    source: FinalizePaidOrderSource,
    options?: { paymobTransactionId?: string | null; paymobRaw?: object },
  ): Promise<FinalizePaidOrderResult> {
    const supabase = this.supabaseService.getClient();
    const shortOrder = shortIdForLog(orderId);

    const existing = await this.loadOrderWithItems(orderId);
    if (!existing) {
      throw new BadRequestException('Order not found');
    }

    const method = String(existing.payment_method || '').toLowerCase();
    if (method !== 'paymob' && method !== 'card') {
      throw new BadRequestException('Order is not a card payment');
    }

    const paymentStatus = String(existing.payment_status || '').toLowerCase();
    const alreadyPaid = paymentStatus === 'paid';

    this.logger.log(
      `[finalizePaidOrder] order=${shortOrder} source=${source} alreadyPaid=${alreadyPaid} user=${shortIdForLog(String(existing.user_id ?? ''))}`,
    );

    if (alreadyPaid) {
      return {
        orderId,
        newlyFinalized: false,
        alreadyPaid: true,
        telegramAttempted: false,
        telegramSent: false,
        order: existing,
      };
    }

    const updatePayload: Record<string, unknown> = {
      payment_status: 'paid',
      status: 'confirmed',
      paid_at: new Date().toISOString(),
      payment_failure_reason: null,
    };

    if (options?.paymobTransactionId) {
      updatePayload.paymob_transaction_id = options.paymobTransactionId;
    }
    if (options?.paymobRaw) {
      updatePayload.payment_raw_response = options.paymobRaw;
    }

    const { data: claimed, error: upErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .eq('payment_status', 'pending')
      .select('id')
      .maybeSingle();

    if (upErr) {
      throw new BadRequestException(upErr.message);
    }

    if (!claimed?.id) {
      const current = await this.loadOrderWithItems(orderId);
      const nowPaid =
        String(current?.payment_status || '').toLowerCase() === 'paid';
      this.logger.log(
        `[finalizePaidOrder] order=${shortOrder} claim lost alreadyPaid=${nowPaid} source=${source}`,
      );
      return {
        orderId,
        newlyFinalized: false,
        alreadyPaid: nowPaid,
        telegramAttempted: false,
        telegramSent: false,
        order: current,
      };
    }

    const finalized = await this.loadOrderWithItems(orderId);

    this.logger.log(
      `[finalizePaidOrder] order=${shortOrder} marked paid source=${source}`,
    );

    let telegramAttempted = false;
    let telegramSent = false;
    if (finalized) {
      telegramAttempted = true;
      this.logger.log(
        `Attempting Paymob Telegram notification for order ${shortOrder} (${source})`,
      );
      const notifyPayload =
        finalized as unknown as AdminOrderNotificationInput;
      try {
        const tgResult =
          await this.notificationsService.sendAdminTelegramNewOrder(
            notifyPayload,
          );
        telegramSent = tgResult.sent;
        if (tgResult.sent) {
          this.logger.log(
            `[finalizePaidOrder] Telegram sent order=${shortOrder}`,
          );
        } else {
          this.logger.warn(
            `[finalizePaidOrder] Telegram not sent order=${shortOrder}: ${tgResult.skipped || tgResult.error || 'unknown'}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `[finalizePaidOrder] Telegram failed order=${shortOrder}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
      this.orderEmailService.sendPaymobPaidConfirmation(notifyPayload);
    }

    return {
      orderId,
      newlyFinalized: true,
      alreadyPaid: false,
      telegramAttempted,
      telegramSent,
      order: finalized,
    };
  }

  /** Ensures card orders stay linked to the logged-in customer (manual + Google OAuth). */
  async linkOrderToAuthenticatedCustomer(
    token: string,
    orderId: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) return;

    const email = user.email?.trim().toLowerCase() ?? '';
    const { error } = await supabase
      .from('orders')
      .update({
        user_id: user.id,
        ...(email ? { customer_email: email } : {}),
      })
      .eq('id', orderId);

    if (error) {
      this.logger.warn(
        `[linkOrderToAuthenticatedCustomer] order=${shortIdForLog(orderId)} failed: ${error.message}`,
      );
    }
  }

  async assertCustomerOwnsOrder(
    token: string,
    orderId: string,
  ): Promise<Record<string, unknown>> {
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
      .select('*, order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(error.message);
    }

    assertCustomerOrderOwnership(
      this.logger,
      'assertCustomerOwnsOrder',
      data,
      user,
      orderId,
    );

    return data as Record<string, unknown>;
  }
}
