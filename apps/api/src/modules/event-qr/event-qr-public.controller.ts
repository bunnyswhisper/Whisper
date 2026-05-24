import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventQrService } from './event-qr.service';
import { RedeemEventQrDto } from './dto/redeem-event-qr.dto';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Public Event QR API (same `apiUrl` base as the web app):
 * - GET  /events/qr/preview/:code
 * - POST /events/qr/redeem
 */
@Controller('events/qr')
export class EventQrPublicController {
  constructor(
    private readonly eventQrService: EventQrService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get('preview/:code')
  @Throttle({ default: { ttl: 60_000, limit: 45 } })
  async preview(
    @Param('code') code: string,
    @Headers('authorization') authorization?: string,
    @Query('deviceKey') deviceKeyQuery?: string,
  ) {
    let userId: string | null = null;
    let email: string | null = null;

    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.replace('Bearer ', '');
      const supabase = this.supabaseService.getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        email = user.email ?? null;
      }
    }

    const deviceKey = deviceKeyQuery?.trim() || null;

    return this.eventQrService.previewCampaign(code, {
      userId,
      email,
      deviceKey,
    });
  }

  @Post('redeem')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  async redeem(
    @Body() body: RedeemEventQrDto,
    @Headers('authorization') authorization?: string,
  ) {
    const code = body.code;
    const deviceKey = body.deviceKey;

    let userId: string | null = null;
    let email: string | null = null;

    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.replace('Bearer ', '');
      const supabase = this.supabaseService.getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        email = user.email ?? null;
      }
    }

    const result = await this.eventQrService.redeemCampaign({
      codeRaw: code,
      userId,
      email,
      deviceKey,
    });

    return {
      ok: true,
      status: result.alreadyRedeemed ? ('already_saved' as const) : ('saved' as const),
      alreadyRedeemed: result.alreadyRedeemed,
      campaign: result.campaign,
    };
  }
}
