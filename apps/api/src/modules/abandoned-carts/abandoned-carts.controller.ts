import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AbandonedCartsService } from './abandoned-carts.service';
import { SyncAbandonedCartDto } from './dto/sync-abandoned-cart.dto';

@Controller('abandoned-cart')
export class AbandonedCartsController {
  constructor(private readonly abandonedCartsService: AbandonedCartsService) {}

  @Post('sync')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  syncCart(
    @Headers('authorization') authorization: string,
    @Body() body: SyncAbandonedCartDto,
  ) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing customer token');
    }

    const token = authorization.replace('Bearer ', '');

    return this.abandonedCartsService.syncCart(token, body.items);
  }
}
