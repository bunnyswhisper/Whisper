import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { SupabaseModule } from '../../supabase/supabase.module';
import AdminGuard from '../orders/orders-admin.guard';

@Module({
  imports: [SupabaseModule],
  controllers: [InventoryController],
  providers: [InventoryService, AdminGuard],
})
export class InventoryModule {}