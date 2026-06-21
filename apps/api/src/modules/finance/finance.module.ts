import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import AdminGuard from '../orders/orders-admin.guard';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [SupabaseModule],
  controllers: [FinanceController],
  providers: [FinanceService, AdminGuard],
})
export class FinanceModule {}
