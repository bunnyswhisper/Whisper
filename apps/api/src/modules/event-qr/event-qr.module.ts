import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { EventQrService } from './event-qr.service';
import { EventQrAdminController } from './event-qr-admin.controller';
import { EventQrPublicController } from './event-qr-public.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [EventQrAdminController, EventQrPublicController],
  providers: [EventQrService],
  exports: [EventQrService],
})
export class EventQrModule {}
