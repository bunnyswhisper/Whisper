import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmailTemplatePayload } from './email-templates.service';
import { EmailTemplatesService } from './email-templates.service';

@Injectable()
export class EmailDeliveryService {
  private readonly logger = new Logger(EmailDeliveryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailTemplates: EmailTemplatesService,
  ) {}

  private getResendApiKey(): string | undefined {
    const k =
      this.configService.get<string>('RESEND_API_KEY')?.trim() ||
      process.env.RESEND_API_KEY?.trim();
    return k || undefined;
  }

  private getFromHeader(): { fromName: string; fromAddress: string } {
    const fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') || "Bunny's Whisper";
    const fromAddress =
      this.configService.get<string>('EMAIL_FROM_ADDRESS') ||
      this.configService.get<string>('EMAIL_FROM') ||
      'orders@bunnyswhisper.com';
    return { fromName, fromAddress };
  }

  isResendConfigured(): boolean {
    return Boolean(this.getResendApiKey());
  }

  /** Resend POST /emails success body is `{ id: string }`, not `{ data: { id } }`. */
  private parseResendSendBody(
    parsed: Record<string, unknown>,
  ): { messageId?: string; errorMessage?: string } {
    const topId = typeof parsed.id === 'string' ? parsed.id : undefined;
    const data = parsed.data as Record<string, unknown> | undefined;
    const nestedId =
      data && typeof data.id === 'string' ? data.id : undefined;

    const messageId = topId || nestedId;

    let errorMessage: string | undefined;
    if (typeof parsed.message === 'string') {
      errorMessage = parsed.message;
    } else if (typeof parsed.error === 'string') {
      errorMessage = parsed.error;
    } else if (parsed.error && typeof parsed.error === 'object') {
      const nested = (parsed.error as Record<string, unknown>).message;
      if (typeof nested === 'string') {
        errorMessage = nested;
      }
    }

    return { messageId, errorMessage };
  }

  private logResendResponse(
    context: string,
    status: number,
    raw: string,
    parsed: Record<string, unknown>,
  ): void {
    const preview = raw.slice(0, 400);
    this.logger.log(
      `Resend ${context} HTTP ${status} body=${preview || '(empty)'}`,
    );
    const { messageId, errorMessage } = this.parseResendSendBody(parsed);
    if (messageId) {
      this.logger.log(`Resend ${context} parsed id=${messageId}`);
    }
    if (errorMessage) {
      this.logger.warn(`Resend ${context} parsed error=${errorMessage}`);
    }
  }

  /**
   * TEMPORARY DEV ONLY — remove before production (used by DebugController).
   * Sends a minimal test message via the same Resend path as production email.
   */
  async sendTestEmail(to: string): Promise<
    { ok: true; id: string } | { ok: false; error: string }
  > {
    const apiKey = this.getResendApiKey();
    if (!apiKey) {
      return { ok: false, error: 'Resend is not configured' };
    }

    const recipient = String(to || '').trim();
    if (!recipient) {
      return { ok: false, error: 'Missing recipient' };
    }

    const { fromName, fromAddress } = this.getFromHeader();
    const template = this.emailTemplates.resendConnectionTest();
    const subject = template.subject;
    const text = template.text;
    const html = template.html;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromAddress}>`,
          to: [recipient],
          subject,
          html,
          text,
        }),
      });

      const raw = await res.text().catch(() => '');
      let parsed: Record<string, unknown> = {};
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }

      this.logResendResponse('test-email', res.status, raw, parsed);

      const { messageId, errorMessage } = this.parseResendSendBody(parsed);

      if (!res.ok) {
        const msg = errorMessage || `HTTP ${res.status}`;
        const safe = String(msg).slice(0, 200);
        this.logger.warn(`Resend test-email failed: ${safe}`);
        return { ok: false, error: safe };
      }

      if (!messageId) {
        const msg =
          errorMessage ||
          (raw
            ? `Unexpected Resend response (HTTP ${res.status}): ${raw.slice(0, 160)}`
            : `Resend returned empty body (HTTP ${res.status})`);
        const safe = String(msg).slice(0, 200);
        this.logger.warn(`Resend test-email failed: ${safe}`);
        return { ok: false, error: safe };
      }

      this.logger.log(`Resend success id: ${messageId}`);
      return { ok: true, id: messageId };
    } catch (err) {
      const safe =
        err instanceof Error ? err.message.slice(0, 200) : 'Unknown error';
      this.logger.warn(`Resend error: ${safe}`);
      return { ok: false, error: safe };
    }
  }

  /**
   * Sends via Resend when RESEND_API_KEY is set. Never throws to callers.
   * Logs a single safe line when provider is missing or send fails.
   */
  async sendIfConfigured(options: {
    to: string;
    template: EmailTemplatePayload;
  }): Promise<{ sent: boolean; messageId?: string }> {
    const apiKey = this.getResendApiKey();
    const { fromName, fromAddress } = this.getFromHeader();

    if (!apiKey) {
      this.logger.log('Email provider not configured; skipped email.');
      return { sent: false };
    }

    const to = String(options.to || '').trim();
    if (!to) {
      this.logger.warn('Email skipped: missing recipient.');
      return { sent: false };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromAddress}>`,
          to: [to],
          subject: options.template.subject,
          html: options.template.html,
          text: options.template.text,
        }),
      });

      const raw = await res.text().catch(() => '');
      let parsed: Record<string, unknown> = {};
      try {
        parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        parsed = {};
      }

      if (!res.ok) {
        const { errorMessage } = this.parseResendSendBody(parsed);
        const detail =
          errorMessage || raw.slice(0, 120) || `HTTP ${res.status}`;
        this.logger.warn(`Email send failed (${res.status}). ${detail}`);
        return { sent: false };
      }

      const { messageId, errorMessage } = this.parseResendSendBody(parsed);
      if (!messageId && errorMessage) {
        this.logger.warn(`Email send warning: ${errorMessage.slice(0, 120)}`);
      }

      return { sent: true, messageId };
    } catch (err) {
      this.logger.warn(
        `Email send error: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return { sent: false };
    }
  }
}
