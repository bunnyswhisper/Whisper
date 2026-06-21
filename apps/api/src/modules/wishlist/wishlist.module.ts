import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import AdminGuard from '../orders/orders-admin.guard';
import {
  WishlistAdminController,
  WishlistController,
} from './wishlist.controller';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [SupabaseModule],
  controllers: [WishlistController, WishlistAdminController],
  providers: [WishlistService, AdminGuard],
})
export class WishlistModule {}
