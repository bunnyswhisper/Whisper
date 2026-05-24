import { Controller, Get, Param, Post, Body, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReviewsService } from './reviews.service';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { PublicSubmitReviewDto } from './dto/public-submit-review.dto';
import { ListPublicReviewsQueryDto } from './dto/list-reviews-query.dto';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  listPublic(@Query() query: ListPublicReviewsQueryDto) {
    return this.reviewsService.listPublicReviews({
      rating: query.rating,
      product: query.product,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      search: query.search,
    });
  }

  @Post('public-submit')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  submitPublicReview(@Body() body: PublicSubmitReviewDto) {
    return this.reviewsService.submitPublicReview(body);
  }

  @Get('invite/:token')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  getInvite(@Param('token') token: string) {
    return this.reviewsService.getInviteByToken(token);
  }

  @Post('submit')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  submitReview(@Body() body: SubmitReviewDto) {
    return this.reviewsService.submitReview(body);
  }
}
