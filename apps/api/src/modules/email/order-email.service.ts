import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { shortIdForLog } from '../../common/safe-log';
import { EmailDeliveryService } from './email-delivery.service';
import { EmailTemplatesService } from './email-templates.service';
import type { OrderEmailOrderRow, OrderEmailType } from './order-email.types';

function trimEnvValue(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim().replace(/^["']|["']$/g, '');
  return t.length > 0 ? t : undefined;
}

@Injectable()
export class OrderEmailService {
  private readonly logger = new Logger(OrderEmailService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
    private readonly emailTemplates: EmailTemplatesService,
    private readonly emailDelivery: EmailDeliveryService,
  ) {}

  private getFrontendBaseUrl(): string {
    const raw =
      trimEnvValue(this.configService.get<string>('FRONTEND_URL')) ??
      trimEnvValue(process.env.FRONTEND_URL) ??
      'http://localhost:3000';
    return raw.replace(/\/$/, '');
  }

  private shortOrderRef(orderId: string | null | undefined): string {
    if (!orderId) return 'ORDER';
    return String(orderId).replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  private customerName(order: OrderEmailOrderRow): string {
    return String(order.customer_name || 'there').trim() || 'there';
  }

  private customerEmail(order: OrderEmailOrderRow): string {
    return String(order.customer_email || '').trim();
  }

  private totalStr(order: OrderEmailOrderRow): string {
    return `EGP ${Number(order.total ?? 0).toFixed(2)}`;
  }

  private cancellationReasonForEmail(order: OrderEmailOrderRow): string {
    const admin = String(order.admin_cancellation_reason || '').trim();
    const returned = String(order.return_reason || '').trim();
    if (admin) return admin;
    if (returned) return returned;
    return 'This order could not be completed. Please contact us if you need help.';
  }

  /** SHA-256 hex of the opaque review invite token. */
  hashReviewToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  generateReviewToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: this.hashReviewToken(token) };
  }

  /**
   * Fire-and-forget wrapper — never throws to order/checkout/finalize/status callers.
   */
  enqueue(
    orderId: string,
    emailType: OrderEmailType,
    order: OrderEmailOrderRow,
    options?: { reviewPlaintextToken?: string },
  ): void {
    void this.trySend(orderId, emailType, order, options).catch((err) => {
      this.logger.warn(
        `[orderEmail] unhandled ${emailType} order=${shortIdForLog(orderId)}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    });
  }

  /**
   * Idempotent send: claims a row in order_email_events first, then sends via Resend.
   */
  async trySend(
    orderId: string,
    emailType: OrderEmailType,
    order: OrderEmailOrderRow,
    options?: { reviewPlaintextToken?: string },
  ): Promise<void> {
    const email = this.customerEmail(order);
    if (!email) {
      this.logger.warn(
        `[orderEmail] skip ${emailType} order=${shortIdForLog(orderId)}: no recipient`,
      );
      return;
    }

    const claimed = await this.claimSendSlot(orderId, emailType);
    if (!claimed) {
      this.logger.log(
        `[orderEmail] skip ${emailType} order=${shortIdForLog(orderId)}: already sent`,
      );
      return;
    }

    const template = this.buildTemplate(
      emailType,
      order,
      options?.reviewPlaintextToken,
    );
    const result = await this.emailDelivery.sendIfConfigured({
      to: email,
      template,
    });

    if (result.messageId) {
      await this.supabaseService
        .getClient()
        .from('order_email_events')
        .update({ resend_message_id: result.messageId })
        .eq('order_id', orderId)
        .eq('email_type', emailType);
    }

    if (result.sent) {
      this.logger.log(
        `[orderEmail] sent ${emailType} order=${shortIdForLog(orderId)}`,
      );
    }
  }

  private buildTemplate(
    emailType: OrderEmailType,
    order: OrderEmailOrderRow,
    reviewPlaintextToken?: string,
  ) {
    const name = this.customerName(order);
    const orderRef = this.shortOrderRef(order.id);
    const total = this.totalStr(order);

    switch (emailType) {
      case 'cod_confirmation':
        return this.emailTemplates.orderConfirmation({
          customerName: name,
          orderRef,
          total,
        });
      case 'paymob_paid_confirmation':
        return this.emailTemplates.paymentConfirmed({
          customerName: name,
          orderRef,
          total,
        });
      case 'order_shipped':
        return this.emailTemplates.orderShipped({
          customerName: name,
          orderRef,
        });
      case 'order_delivered': {
        const reviewUrl = reviewPlaintextToken
          ? `${this.getFrontendBaseUrl()}/review/${encodeURIComponent(reviewPlaintextToken)}`
          : undefined;
        return this.emailTemplates.orderDelivered({
          customerName: name,
          orderRef,
          reviewUrl,
        });
      }
      case 'order_cancelled':
        return this.emailTemplates.orderCancelled({
          customerName: name,
          orderRef,
          cancellationReason: this.cancellationReasonForEmail(order),
        });
      default:
        return this.emailTemplates.orderConfirmation({
          customerName: name,
          orderRef,
          total,
        });
    }
  }

  /** Insert claim row; returns true only when this caller won the send slot. */
  private async claimSendSlot(
    orderId: string,
    emailType: OrderEmailType,
  ): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.from('order_email_events').insert({
      order_id: orderId,
      email_type: emailType,
    });

    if (!error) {
      return true;
    }

    const code = String((error as { code?: string }).code || '');
    const msg = String(error.message || '').toLowerCase();
    if (code === '23505' || msg.includes('duplicate')) {
      return false;
    }

    this.logger.warn(
      `[orderEmail] claim failed ${emailType} order=${shortIdForLog(orderId)}: ${error.message}`,
    );
    return false;
  }

  /**
   * On first delivered email: persist review token hash, return plaintext for email URL only.
   */
  async ensureReviewInviteToken(orderId: string): Promise<string | undefined> {
    const supabase = this.supabaseService.getClient();

    const { data: priorSend } = await supabase
      .from('order_email_events')
      .select('id')
      .eq('order_id', orderId)
      .eq('email_type', 'order_delivered')
      .maybeSingle();

    if (priorSend?.id) {
      return undefined;
    }

    const { data: row, error } = await supabase
      .from('orders')
      .select('id, review_token_hash')
      .eq('id', orderId)
      .maybeSingle();

    if (error || !row?.id) {
      this.logger.warn(
        `[orderEmail] review token load failed order=${shortIdForLog(orderId)}`,
      );
      return undefined;
    }

    const { token, hash } = this.generateReviewToken();
    const { error: upErr } = await supabase
      .from('orders')
      .update({
        review_token_hash: hash,
        review_token_issued_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (upErr) {
      this.logger.warn(
        `[orderEmail] review token save failed order=${shortIdForLog(orderId)}: ${upErr.message}`,
      );
      return undefined;
    }

    return token;
  }

  sendCodConfirmation(order: OrderEmailOrderRow): void {
    const orderId = String(order.id || '').trim();
    if (!orderId) return;
    this.enqueue(orderId, 'cod_confirmation', order);
  }

  sendPaymobPaidConfirmation(order: OrderEmailOrderRow): void {
    const orderId = String(order.id || '').trim();
    if (!orderId) return;
    this.enqueue(orderId, 'paymob_paid_confirmation', order);
  }

  sendOrderShipped(order: OrderEmailOrderRow): void {
    const orderId = String(order.id || '').trim();
    if (!orderId) return;
    this.enqueue(orderId, 'order_shipped', order);
  }

  sendOrderCancelled(order: OrderEmailOrderRow): void {
    const orderId = String(order.id || '').trim();
    if (!orderId) return;
    this.enqueue(orderId, 'order_cancelled', order);
  }

  sendOrderDelivered(order: OrderEmailOrderRow): void {
    const orderId = String(order.id || '').trim();
    if (!orderId) return;

    void (async () => {
      try {
        const reviewToken = await this.ensureReviewInviteToken(orderId);
        await this.trySend(orderId, 'order_delivered', order, {
          reviewPlaintextToken: reviewToken,
        });
      } catch (err) {
        this.logger.warn(
          `[orderEmail] delivered failed order=${shortIdForLog(orderId)}: ${err instanceof Error ? err.message : 'unknown'}`,
        );
      }
    })();
  }
}
