import { Module, forwardRef } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SupabaseModule } from '../../supabase/supabase.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import AdminGuard from '../orders/orders-admin.guard';

@Module({
  imports: [
    SupabaseModule,
    NotificationsModule,
    forwardRef(() => OrdersModule),
  ],
  exports: [PaymentsService],
  controllers: [PaymentsController],
  providers: [PaymentsService, AdminGuard],
})
export class PaymentsModule {}
