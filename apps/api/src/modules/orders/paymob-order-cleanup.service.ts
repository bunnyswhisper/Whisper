import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { shortIdForLog } from '../../common/safe-log';

export type PaymobUnpaidResolution = 'failed' | 'expired';

export type ReleaseUnpaidPaymobOrderResult = {
  released: boolean;
  stockRestored: boolean;
  reason?: string;
  paymentStatusAfter?: string;
};

/**
 * Restores inventory for unpaid Paymob orders exactly once.
 * Uses order lifecycle status `cancelled` as the idempotency guard (stock is released
 * only when transitioning into cancelled from a releasable pending state).
 */
@Injectable()
export class PaymobOrderCleanupService {
  private readonly logger = new Logger(PaymobOrderCleanupService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  getPendingExpiryMinutes(): number {
    const raw = this.configService.get<string>('PAYMOB_PENDING_EXPIRY_MINUTES');
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return 60;
  }

  private resolveVariantId(item: Record<string, unknown>): string | null {
    const direct =
      (item.variant_id as string) ||
      (item.product_variant_id as string) ||
      (item.productVariantId as string) ||
      (item.variantId as string);
    if (direct && String(direct).length > 0) return String(direct);
    return null;
  }

  private async restoreStockForOrderItems(
    orderId: string,
    items: Record<string, unknown>[],
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    for (const item of items) {
      const variantId = this.resolveVariantId(item);
      const qty = Math.max(0, Number(item.quantity) || 0);
      if (!variantId || qty <= 0) {
        this.logger.warn(
          `[releaseUnpaidPaymob] order=${shortIdForLog(orderId)} skip line (missing variant_id or qty)`,
        );
        continue;
      }

      const { data: row, error: fetchErr } = await supabase
        .from('product_variants')
        .select('id, stock_quantity')
        .eq('id', variantId)
        .maybeSingle();

      if (fetchErr) {
        throw new BadRequestException(fetchErr.message);
      }
      if (!row?.id) {
        this.logger.warn(
          `[releaseUnpaidPaymob] order=${shortIdForLog(orderId)} variant ${shortIdForLog(variantId)} not found`,
        );
        continue;
      }

      const current = Number(row.stock_quantity || 0);
      const next = current + qty;

      const { error: upErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: next })
        .eq('id', variantId)
        .eq('stock_quantity', current);

      if (upErr) {
        throw new BadRequestException(upErr.message);
      }
    }
  }

  /**
   * Mark unpaid Paymob order cancelled and restore variant stock once.
   */
  async releaseUnpaidPaymobOrderInventory(
    orderId: string,
    resolution: PaymobUnpaidResolution,
    options?: { paymentFailureReason?: string },
  ): Promise<ReleaseUnpaidPaymobOrderResult> {
    const supabase = this.supabaseService.getClient();
    const shortOrder = shortIdForLog(orderId);

    const { data: order, error: loadErr } = await supabase
      .from('orders')
      .select('id, payment_method, payment_status, status, order_items(*)')
      .eq('id', orderId)
      .maybeSingle();

    if (loadErr) {
      throw new BadRequestException(loadErr.message);
    }
    if (!order) {
      return { released: false, stockRestored: false, reason: 'not_found' };
    }

    const method = String(order.payment_method || '').toLowerCase();
    if (method !== 'paymob' && method !== 'card') {
      return { released: false, stockRestored: false, reason: 'not_paymob' };
    }

    const paymentStatus = String(order.payment_status || '').toLowerCase();
    const lifecycleStatus = String(order.status || '').toLowerCase();

    if (paymentStatus === 'paid') {
      return {
        released: false,
        stockRestored: false,
        reason: 'already_paid',
        paymentStatusAfter: 'paid',
      };
    }

    if (lifecycleStatus === 'cancelled') {
      return {
        released: false,
        stockRestored: false,
        reason: 'already_released',
        paymentStatusAfter: paymentStatus,
      };
    }

    const terminalLifecycle = new Set([
      'confirmed',
      'shipped',
      'delivered',
      'returned',
    ]);
    if (terminalLifecycle.has(lifecycleStatus)) {
      return {
        released: false,
        stockRestored: false,
        reason: 'terminal_lifecycle',
        paymentStatusAfter: paymentStatus,
      };
    }

    const items = Array.isArray(order.order_items)
      ? (order.order_items as Record<string, unknown>[])
      : [];

    const failureReason =
      options?.paymentFailureReason?.trim() ||
      (resolution === 'expired'
        ? 'Payment session expired'
        : 'Payment failed or was cancelled');

    let claimed: { id: string; payment_status: string } | null = null;

    if (paymentStatus === 'pending' && lifecycleStatus === 'pending') {
      const nextPaymentStatus =
        resolution === 'expired' ? 'expired' : 'failed';

      const { data, error } = await supabase
        .from('orders')
        .update({
          payment_status: nextPaymentStatus,
          status: 'cancelled',
          payment_failure_reason: failureReason,
        })
        .eq('id', orderId)
        .eq('payment_method', 'paymob')
        .eq('payment_status', 'pending')
        .eq('status', 'pending')
        .select('id, payment_status')
        .maybeSingle();

      if (error) {
        throw new BadRequestException(error.message);
      }
      claimed = data;
    } else if (
      (paymentStatus === 'failed' || paymentStatus === 'expired') &&
      lifecycleStatus === 'pending'
    ) {
      const { data, error } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          payment_failure_reason: failureReason,
        })
        .eq('id', orderId)
        .eq('payment_method', 'paymob')
        .in('payment_status', ['failed', 'expired'])
        .eq('status', 'pending')
        .select('id, payment_status')
        .maybeSingle();

      if (error) {
        throw new BadRequestException(error.message);
      }
      claimed = data;
    } else {
      return {
        released: false,
        stockRestored: false,
        reason: 'not_releasable',
        paymentStatusAfter: paymentStatus,
      };
    }

    if (!claimed?.id) {
      return {
        released: false,
        stockRestored: false,
        reason: 'claim_lost',
        paymentStatusAfter: paymentStatus,
      };
    }

    await this.restoreStockForOrderItems(orderId, items);

    this.logger.log(
      `[releaseUnpaidPaymob] order=${shortOrder} stock restored (${items.length} line(s)) payment_status=${claimed.payment_status}`,
    );

    return {
      released: true,
      stockRestored: true,
      paymentStatusAfter: String(claimed.payment_status || resolution),
    };
  }
}
