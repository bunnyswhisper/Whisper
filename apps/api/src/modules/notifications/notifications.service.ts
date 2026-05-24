import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AdminOrderNotificationInput } from './admin-order-notification.types';
import { buildAdminNewOrderTelegramHtmlMessage } from './notification-message.util';

function trimEnvValue(raw: string | undefined): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim().replace(/^["']|["']$/g, '');
  return t.length > 0 ? t : undefined;
}

export type AdminTelegramSendResult = {
  sent: boolean;
  skipped?: 'not_configured';
  error?: string;
};

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const { token, chatId } = this.getTelegramCredentials();
    const configured = Boolean(token && chatId);
    this.logger.log(`Telegram configured: ${configured ? 'yes' : 'no'}`);
  }

  private getTelegramCredentials(): { token?: string; chatId?: string } {
    const token =
      trimEnvValue(this.configService.get<string>('TELEGRAM_BOT_TOKEN')) ??
      trimEnvValue(process.env.TELEGRAM_BOT_TOKEN);
    const chatId =
      trimEnvValue(this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID')) ??
      trimEnvValue(process.env.TELEGRAM_ADMIN_CHAT_ID);
    return { token, chatId };
  }

  private getFrontendBaseUrl(): string {
    const raw =
      trimEnvValue(this.configService.get<string>('FRONTEND_URL')) ??
      trimEnvValue(process.env.FRONTEND_URL) ??
      'http://localhost:3000';
    return raw.replace(/\/$/, '');
  }

  private buildAdminManageOrderUrl(order: AdminOrderNotificationInput): string {
    const base = this.getFrontendBaseUrl();
    const id = order.id != null ? String(order.id).trim() : '';
    if (id) {
      return `${base}/admin/orders?orderId=${encodeURIComponent(id)}`;
    }
    return `${base}/admin/orders`;
  }

  /**
   * Admin Telegram only — independent from customer email (OrderEmailService).
   */
  async sendAdminTelegramNewOrder(
    order: AdminOrderNotificationInput,
  ): Promise<AdminTelegramSendResult> {
    const shortId =
      order.id != null ? String(order.id).replace(/-/g, '').slice(0, 8) : 'unknown';
    const method = String(order.payment_method || '').toLowerCase();

    try {
      return await this.sendTelegramAdminNewOrder(order, shortId, method);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(
        `Telegram pipeline error order=${shortId}: ${msg}`,
      );
      return { sent: false, error: msg };
    }
  }

  /** @deprecated Use sendAdminTelegramNewOrder — kept for existing call sites. */
  async sendAdminNewOrderNotification(
    order: AdminOrderNotificationInput,
  ): Promise<void> {
    await this.sendAdminTelegramNewOrder(order);
  }

  private async sendTelegramAdminNewOrder(
    order: AdminOrderNotificationInput,
    shortId: string,
    method: string,
  ): Promise<AdminTelegramSendResult> {
    const { token, chatId } = this.getTelegramCredentials();

    if (!token || !chatId) {
      this.logger.warn(
        `Telegram skipped order=${shortId}: TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID missing`,
      );
      return { sent: false, skipped: 'not_configured' };
    }

    this.logger.log(
      `Sending Telegram admin notification order=${shortId} payment=${method || 'unknown'}`,
    );

    const manageUrl = this.buildAdminManageOrderUrl(order);
    const text = buildAdminNewOrderTelegramHtmlMessage(order, manageUrl);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const safe = body.slice(0, 200);
      this.logger.warn(
        `Telegram failed order=${shortId}: HTTP ${res.status} ${safe}`,
      );
      return { sent: false, error: `HTTP ${res.status}` };
    }

    this.logger.log(`Telegram notification sent order=${shortId}`);
    return { sent: true };
  }
}
