import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { CreatePaymobIntentionDto } from './dto/create-paymob-intention.dto';
import { FinalizePaymobOrderDto } from './dto/finalize-paymob-order.dto';
import AdminGuard from '../orders/orders-admin.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('paymob/finalize-order')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  finalizePaymobOrder(
    @Body() body: FinalizePaymobOrderDto,
    @Headers('authorization') authorization?: string,
  ) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing customer token');
    }
    const token = authorization.replace('Bearer ', '');
    return this.paymentsService.finalizePaymobOrderAfterReturn(
      body.orderId,
      token,
      body.redirectCallback,
    );
  }

  @Post('paymob/create-intention')
  @Throttle({ default: { ttl: 60_000, limit: 25 } })
  createPaymobIntention(
    @Body() body: CreatePaymobIntentionDto,
    @Headers('authorization') authorization?: string,
  ) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing customer token');
    }
    const token = authorization.replace('Bearer ', '');
    return this.paymentsService.createPaymobIntention(body.orderId, token);
  }

  /** High limit: real Paymob retries; invalid payloads still fail fast on HMAC. */
  @Post('paymob/webhook')
  @Throttle({ default: { ttl: 60_000, limit: 200 } })
  paymobWebhook(
    @Body() body: Record<string, unknown>,
    @Query('hmac') hmac?: string,
  ) {
    return this.paymentsService.handlePaymobWebhook(body, hmac);
  }

  @Post('paymob/expire-pending')
  @UseGuards(AdminGuard)
  expirePending(@Query('minutes') minutes?: string) {
    // TODO(production): trigger this via server-side scheduler (every 5-10 minutes).
    // Keep this endpoint for safe manual/local admin invocation only.
    const parsed = Number(minutes);
    const ttl = Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
    return this.paymentsService
      .expireStalePaymobPendingOrders(ttl)
      .then((r) => ({
        ok: true,
        expiredCount: r.expired,
        finalizedCount: r.finalized,
        legacyReleased: r.legacyReleased,
        stockReleased: r.stockReleased,
        scanned: r.scanned,
      }));
  }

  @Get('paymob/expire-pending')
  @UseGuards(AdminGuard)
  expirePendingGet(@Query('minutes') minutes?: string) {
    // TODO(production): trigger this via server-side scheduler (every 5-10 minutes).
    // Keep this endpoint for safe manual/local admin invocation only.
    const parsed = Number(minutes);
    const ttl = Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
    return this.paymentsService
      .expireStalePaymobPendingOrders(ttl)
      .then((r) => ({
        ok: true,
        expiredCount: r.expired,
        finalizedCount: r.finalized,
        legacyReleased: r.legacyReleased,
        stockReleased: r.stockReleased,
        scanned: r.scanned,
      }));
  }
}
