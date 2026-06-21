import {
  Controller,
  Get,
  Headers,
  Post,
  Body,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import AdminGuard from '../orders/orders-admin.guard';
import { WishlistService } from './wishlist.service';
import { ToggleWishlistDto } from './dto/toggle-wishlist.dto';

@Controller('customer/wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  private getToken(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing customer token');
    }
    return authorization.replace('Bearer ', '');
  }

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 90 } })
  getWishlist(@Headers('authorization') authorization?: string) {
    return this.wishlistService.getWishlist(this.getToken(authorization));
  }

  @Get('ids')
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  getWishlistIds(@Headers('authorization') authorization?: string) {
    return this.wishlistService.getProductIds(this.getToken(authorization));
  }

  @Post('toggle')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  toggleWishlist(
    @Headers('authorization') authorization: string,
    @Body() body: ToggleWishlistDto,
  ) {
    return this.wishlistService.toggleWishlist(
      this.getToken(authorization),
      body.productId,
    );
  }
}

@Controller('admin/wishlist')
@UseGuards(AdminGuard)
export class WishlistAdminController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get('analytics')
  getAnalytics() {
    return this.wishlistService.getAdminAnalytics();
  }
}
