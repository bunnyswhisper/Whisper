import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderFinalizationService } from './order-finalization.service';
import { PaymobOrderCleanupService } from './paymob-order-cleanup.service';
import { SupabaseModule } from '../../supabase/supabase.module';
import AdminGuard from './orders-admin.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailModule } from '../email/email.module';
import { EventQrModule } from '../event-qr/event-qr.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    SupabaseModule,
    NotificationsModule,
    EmailModule,
    EventQrModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderFinalizationService, PaymobOrderCleanupService, AdminGuard],
  exports: [OrdersService, OrderFinalizationService, PaymobOrderCleanupService],
})
export class OrdersModule {}