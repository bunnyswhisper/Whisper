import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import AdminGuard from '../orders/orders-admin.guard';
import { ReviewsService } from './reviews.service';
import { ListAdminReviewsQueryDto } from './dto/list-reviews-query.dto';
import { AdminReviewReplyDto } from './dto/admin-review-reply.dto';

@Controller('admin/reviews')
@UseGuards(AdminGuard)
export class ReviewsAdminController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  listReviews(@Query() query: ListAdminReviewsQueryDto) {
    return this.reviewsService.listAdminReviews({
      state: query.state,
      rating: query.rating,
      product: query.product,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      search: query.search,
    });
  }

  @Patch(':id/approve')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async approve(@Param('id') id: string, @Req() req: Request) {
    const adminEmail = await this.reviewsService.resolveAdminEmail(req);
    return this.reviewsService.approveReview(id, adminEmail);
  }

  @Patch(':id/reply')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async updateReply(
    @Param('id') id: string,
    @Body() body: AdminReviewReplyDto,
    @Req() req: Request,
  ) {
    const adminEmail = await this.reviewsService.resolveAdminEmail(req);
    return this.reviewsService.updateAdminReply(id, body, adminEmail);
  }

  @Patch(':id/hide')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async hide(@Param('id') id: string, @Req() req: Request) {
    const adminEmail = await this.reviewsService.resolveAdminEmail(req);
    return this.reviewsService.hideReview(id, adminEmail);
  }

  @Patch(':id/unhide')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  unhide(@Param('id') id: string) {
    return this.reviewsService.unhideReview(id);
  }

  @Patch(':id/delete')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async softDelete(@Param('id') id: string, @Req() req: Request) {
    const adminEmail = await this.reviewsService.resolveAdminEmail(req);
    return this.reviewsService.softDeleteReview(id, adminEmail);
  }

  @Patch(':id/restore')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  restore(@Param('id') id: string) {
    return this.reviewsService.restoreReview(id);
  }
}
