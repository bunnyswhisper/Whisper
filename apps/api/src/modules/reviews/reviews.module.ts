import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { EmailModule } from '../email/email.module';
import AdminGuard from '../orders/orders-admin.guard';
import { ReviewsController } from './reviews.controller';
import { ReviewsAdminController } from './reviews-admin.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [SupabaseModule, EmailModule],
  controllers: [ReviewsController, ReviewsAdminController],
  providers: [ReviewsService, AdminGuard],
  exports: [ReviewsService],
})
export class ReviewsModule {}
