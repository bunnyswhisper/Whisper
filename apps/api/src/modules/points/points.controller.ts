import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PointsService } from './points.service';
import { ClaimPointsDto } from './dto/claim-points.dto';
import { RedeemCouponDto } from './dto/redeem-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  private getToken(authorization?: string) {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing token');
    }

    return authorization.replace('Bearer ', '');
  }

  @Get('me')
  @Throttle({ default: { ttl: 60_000, limit: 90 } })
  getMyPoints(@Headers('authorization') authorization?: string) {
    const token = this.getToken(authorization);
    return this.pointsService.getMyPoints(token);
  }

  @Post('claim')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  claimPoints(
    @Headers('authorization') authorization: string,
    @Body() body: ClaimPointsDto,
  ) {
    const token = this.getToken(authorization);
    return this.pointsService.claimPoints(token, body.code);
  }

  @Post('redeem')
  @Throttle({ default: { ttl: 60_000, limit: 12 } })
  redeemCoupon(
    @Headers('authorization') authorization: string,
    @Body() body: RedeemCouponDto,
  ) {
    const token = this.getToken(authorization);
    return this.pointsService.redeemCoupon(token, body.pointsCost);
  }

  @Post('validate-coupon')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  validateCoupon(
    @Headers('authorization') authorization: string,
    @Body() body: ValidateCouponDto,
  ) {
    const token = this.getToken(authorization);
    return this.pointsService.validateCoupon(
      token,
      body.code,
      body.subtotal,
      body.deliveryFee ?? 0,
    );
  }

  @Post('claim-order')
  @Throttle({ default: { ttl: 60_000, limit: 15 } })
  claimOrderPoints(
    @Headers('authorization') authorization: string,
    @Body() body: ClaimPointsDto,
  ) {
    const token = this.getToken(authorization);
    return this.pointsService.claimOrderPoints(token, body.code);
  }
}