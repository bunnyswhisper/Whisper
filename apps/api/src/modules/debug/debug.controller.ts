/**
 * TEMPORARY DEV ONLY — remove before production.
 * Debug HTTP surface for local/staging verification (Resend, etc.).
 */

import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { EmailDeliveryService } from '../email/email-delivery.service';
import { EventQrService } from '../event-qr/event-qr.service';

@Controller('debug')
@SkipThrottle()
export class DebugController {
  private readonly logger = new Logger(DebugController.name);

  constructor(
    private readonly emailDelivery: EmailDeliveryService,
    private readonly eventQrService: EventQrService,
  ) {}

  @Get('test-email')
  async testEmail(@Query('to') to?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    const recipient = String(to ?? '').trim();
    if (!recipient || !recipient.includes('@')) {
      return {
        ok: false as const,
        error: 'Invalid or missing to query parameter (expected an email address)',
      };
    }

    const configured = this.emailDelivery.isResendConfigured();
    this.logger.log(`Resend configured: ${configured ? 'yes' : 'no'}`);

    if (!configured) {
      return { ok: false as const, error: 'Resend is not configured' };
    }

    this.logger.log(`Attempting debug email to ${recipient}`);

    const result = await this.emailDelivery.sendTestEmail(recipient);

    if (result.ok) {
      return { ok: true as const, id: result.id };
    }
    return { ok: false as const, error: result.error };
  }

  /**
   * Temporary: inspect Events QR preview resolution without auth.
   * Disabled in production (404).
   */
  @Get('event-qr-preview/:code')
  async eventQrPreview(@Param('code') code: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    return this.eventQrService.getDebugEventQrPreviewSnapshot(code);
  }
}
