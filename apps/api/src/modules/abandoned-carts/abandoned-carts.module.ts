import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { AbandonedCartsController } from './abandoned-carts.controller';
import { AbandonedCartsService } from './abandoned-carts.service';

@Module({
  imports: [SupabaseModule],
  controllers: [AbandonedCartsController],
  providers: [AbandonedCartsService],
})
export class AbandonedCartsModule {}