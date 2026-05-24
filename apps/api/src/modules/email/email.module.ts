import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { EmailTemplatesService } from './email-templates.service';
import { EmailDeliveryService } from './email-delivery.service';
import { OrderEmailService } from './order-email.service';

@Module({
  imports: [SupabaseModule],
  providers: [EmailTemplatesService, EmailDeliveryService, OrderEmailService],
  exports: [EmailTemplatesService, EmailDeliveryService, OrderEmailService],
})
export class EmailModule {}
